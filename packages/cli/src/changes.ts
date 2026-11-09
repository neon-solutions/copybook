import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { loadConfigSource } from "./config";
import type { ResolvedConfig } from "./config";
import { changedFiles, listFiles, showFile } from "./git";
import { DEFAULT_EXCLUDE } from "./load";
import type { Project } from "./load";
import {
  markdownDir,
  markdownFile,
  markdownId,
  markdownUrl,
  matchesSource,
} from "./markdown";
import { compareSnapshots, SNAPSHOT_EXTENSION } from "./snapshot";
import type { Snapshot } from "./snapshot";

/**
 * Ids of Markdown prompts whose files differ from `base`, including deleted
 * ones. Markdown files are their own snapshots.
 */
const changedMarkdownIds = async (
  project: Project,
  base: string
): Promise<string[]> => {
  const { config } = project;
  const lists = await Promise.all(
    (config.markdown ?? []).map(async (source) => {
      // git reports real paths, so compare against the real directory.
      const dir = await realpath(markdownDir(config, source));
      const isPrompt = matchesSource(source, DEFAULT_EXCLUDE);
      const files = await changedFiles(config.root, dir, base);
      return files.flatMap((file) => {
        const fileInDir = path.relative(dir, file).split(path.sep).join("/");
        return isPrompt(fileInDir) ? [markdownId(source, fileInDir)] : [];
      });
    })
  );
  return lists.flat();
};

/** A definition that existed at a base, and the file it came from. */
export interface RemovedDefinition {
  /** The Markdown file it was, relative to the config root. */
  file?: string;
  id: string;
  /** Where the product served it, for a Markdown prompt with a `url`. */
  url?: string;
}

/** The config as it was at `base`, or nothing if there wasn't one. */
const configAtBase = async (
  config: ResolvedConfig,
  base: string
): Promise<ResolvedConfig | undefined> => {
  const [then, now] = await Promise.all([
    showFile(config.root, base, config.file),
    readFile(config.file, "utf-8"),
  ]);
  if (then === undefined) {
    return;
  }
  if (then === now) {
    return config;
  }
  // A base config that no longer loads is read as the current one.
  return loadConfigSource(then, config.file).catch(() => config);
};

/**
 * The Markdown prompts at `base`: the files that were there, read with the
 * config as it was then, so changes to `idPrefix`, `dir`, or `include` show.
 */
const markdownAtBase = async (
  project: Project,
  base: string
): Promise<(RemovedDefinition & { file: string })[]> => {
  const { config } = project;
  const then = await configAtBase(config, base);
  const lists = await Promise.all(
    (then?.markdown ?? []).map(async (source) => {
      const isPrompt = matchesSource(source, DEFAULT_EXCLUDE);
      const files = await listFiles(
        config.root,
        base,
        markdownDir(config, source)
      );
      return files.filter(isPrompt).map((fileInDir) => {
        const url = markdownUrl(source, fileInDir);
        return {
          file: markdownFile(config, source, fileInDir),
          id: markdownId(source, fileInDir),
          ...(url === undefined ? {} : { url }),
        };
      });
    })
  );
  return lists.flat();
};

/**
 * Ids whose rendered output differs from `base`: snapshot files changed in
 * git, plus definitions whose snapshot isn't written yet.
 */
export const changedIds = async (
  project: Project,
  snapshots: readonly Snapshot[],
  base: string
): Promise<string[]> => {
  const [files, markdown, atBase, status] = await Promise.all([
    changedFiles(project.config.root, project.config.snapshotsDir, base),
    changedMarkdownIds(project, base),
    markdownAtBase(project, base),
    compareSnapshots(project.config, snapshots),
  ]);
  const defined = new Set(snapshots.map((snapshot) => snapshot.id));
  const before = new Set(atBase.map(({ id }) => id));
  // Markdown prompts that are new since base, such as after an idPrefix change.
  const added = project.definitions
    .filter(
      ({ definition, markdown: file }) => file && !before.has(definition.id)
    )
    .map(({ definition }) => definition.id);
  const ids = new Set([
    ...files
      .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
      .map((file) => path.basename(file, SNAPSHOT_EXTENSION)),
    ...markdown,
    ...added,
    ...status.missing,
    ...status.changed.map((change) => change.id),
  ]);
  return [...ids].filter((id) => defined.has(id)).toSorted();
};

/**
 * Definitions removed since `base` whose id isn't kept as an alias: snapshot
 * files that existed at `base` (so renames still count as removals), and
 * Markdown prompts that existed at `base`.
 */
export const removedSince = async (
  project: Project,
  base: string
): Promise<RemovedDefinition[]> => {
  const [snapshotFiles, markdown] = await Promise.all([
    listFiles(project.config.root, base, project.config.snapshotsDir),
    markdownAtBase(project, base),
  ]);
  const current = new Set(
    project.definitions.map(({ definition }) => definition.id)
  );
  const aliases = new Set(
    project.definitions.flatMap(({ definition }) => definition.aliases ?? [])
  );
  const removed = new Map<string, RemovedDefinition>();
  for (const file of snapshotFiles) {
    if (file.endsWith(SNAPSHOT_EXTENSION)) {
      const id = path.basename(file, SNAPSHOT_EXTENSION);
      removed.set(id, { id });
    }
  }
  for (const prompt of markdown) {
    removed.set(prompt.id, prompt);
  }
  return [...removed.values()]
    .filter(({ id }) => !current.has(id) && !aliases.has(id))
    .toSorted((a, b) => a.id.localeCompare(b.id));
};
