import { realpath } from "node:fs/promises";
import path from "node:path";

import { changedFiles } from "./git";
import { DEFAULT_EXCLUDE } from "./load";
import type { Project } from "./load";
import { markdownDir, markdownId, matchesSource } from "./markdown";
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

/**
 * Ids whose rendered output differs from `base`: snapshot files changed in
 * git, plus definitions whose snapshot isn't written yet.
 */
export const changedIds = async (
  project: Project,
  snapshots: readonly Snapshot[],
  base: string
): Promise<string[]> => {
  const [files, markdown, status] = await Promise.all([
    changedFiles(project.config.root, project.config.snapshotsDir, base),
    changedMarkdownIds(project, base),
    compareSnapshots(project.config, snapshots),
  ]);
  const defined = new Set(snapshots.map((snapshot) => snapshot.id));
  const ids = new Set([
    ...files
      .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
      .map((file) => path.basename(file, SNAPSHOT_EXTENSION)),
    ...markdown,
    ...status.missing,
    ...status.changed.map((change) => change.id),
  ]);
  return [...ids].filter((id) => defined.has(id)).toSorted();
};

/**
 * Snapshot files and Markdown prompts removed since `base` whose id isn't
 * kept as an alias.
 */
export const removedWithoutAlias = async (
  project: Project,
  base: string
): Promise<string[]> => {
  const [files, markdown] = await Promise.all([
    changedFiles(project.config.root, project.config.snapshotsDir, base),
    changedMarkdownIds(project, base),
  ]);
  const current = new Set(
    project.definitions.map(({ definition }) => definition.id)
  );
  const aliases = new Set(
    project.definitions.flatMap(({ definition }) => definition.aliases ?? [])
  );
  const ids = files
    .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
    .map((file) => path.basename(file, SNAPSHOT_EXTENSION));
  return [...new Set([...ids, ...markdown])].filter(
    (id) => !current.has(id) && !aliases.has(id)
  );
};
