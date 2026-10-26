import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectEmbeds,
  listVariants,
  renderExample,
  toText,
} from "@prompt-manager/core";
import type { AnyParam, Definition, Rendered } from "@prompt-manager/core";

import type { ResolvedConfig } from "./config";
import { frontmatter } from "./frontmatter";
import type { LoadedDefinition } from "./load";

export const SNAPSHOT_EXTENSION = ".md";

export interface Snapshot {
  content: string;
  embeds: string[];
  /** A hash of the rendered output, ignoring metadata. */
  hash: string;
  id: string;
  /** Absolute path of the snapshot file. */
  path: string;
}

const BACKTICK_RUN = /`+/gu;

/** A code fence long enough to wrap content that has its own fences. */
const fence = (lang: string | undefined, content: string) => {
  const longest = Math.max(
    0,
    ...[...content.matchAll(BACKTICK_RUN)].map((match) => match[0].length)
  );
  const ticks = "`".repeat(Math.max(3, longest + 1));
  return `${ticks}${lang ?? ""}\n${content}\n${ticks}`;
};

const exampleValue = (param: AnyParam): unknown => {
  const { state } = param;
  return state.example ?? state.default ?? state.placeholder ?? null;
};

const renderBody = (
  definition: Definition
): { body: string; trees: Rendered[] } => {
  if (definition.kind === "prompt") {
    const tree = renderExample(definition);
    return { body: toText(tree), trees: [tree] };
  }
  if (definition.kind === "command") {
    const tree = renderExample(definition);
    return {
      body: fence("sh", toText(tree, { format: "plain" })),
      trees: [tree],
    };
  }
  const variants = listVariants(definition);
  const trees = variants.map((variant) =>
    renderExample(definition, { variant: variant.key })
  );
  const blocks = trees.map((tree, index) => {
    const code = fence(tree.lang, toText(tree, { format: "plain" }));
    const variant = variants[index];
    return variant && variant.key !== ""
      ? `## ${variant.key}\n\n${code}`
      : code;
  });
  return { body: blocks.join("\n\n"), trees };
};

export const snapshotPath = (config: ResolvedConfig, id: string) =>
  path.join(config.snapshotsDir, `${id}${SNAPSHOT_EXTENSION}`);

/** Renders a definition with its examples into a reviewable Markdown file. */
export const createSnapshot = (
  config: ResolvedConfig,
  { definition, exportName, file }: LoadedDefinition
): Snapshot => {
  const { body, trees } = renderBody(definition);
  const embeds = [...new Set(trees.flatMap((tree) => collectEmbeds(tree)))];
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
  const params = Object.fromEntries(
    Object.entries(definition.params).map(([name, param]) => [
      name,
      exampleValue(param),
    ])
  );

  const header = frontmatter([
    ["id", definition.id],
    ["kind", definition.kind],
    ["title", definition.title],
    ["source", `${file}#${exportName}`],
    ["placements", definition.placements ?? []],
    ["params", params],
    ["embeds", embeds],
    ["hash", `sha256:${hash}`],
  ]);

  return {
    content: `${header}\n${body}\n`,
    embeds,
    hash,
    id: definition.id,
    path: snapshotPath(config, definition.id),
  };
};

/** Ids that have a snapshot file on disk. */
export const listSnapshotIds = async (
  config: ResolvedConfig
): Promise<string[]> => {
  if (!existsSync(config.snapshotsDir)) {
    return [];
  }
  const files = await readdir(config.snapshotsDir);
  return files
    .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
    .map((file) => file.slice(0, -SNAPSHOT_EXTENSION.length))
    .toSorted();
};

export interface SnapshotStatus {
  /** Snapshots whose content changed. */
  changed: { current: string; id: string; next: string }[];
  /** Definitions without a snapshot yet. */
  missing: string[];
  /** Snapshot files without a definition. */
  orphaned: string[];
}

export const compareSnapshots = async (
  config: ResolvedConfig,
  snapshots: readonly Snapshot[]
): Promise<SnapshotStatus> => {
  const status: SnapshotStatus = { changed: [], missing: [], orphaned: [] };
  const ids = new Set(snapshots.map((snapshot) => snapshot.id));

  const [contents, onDisk] = await Promise.all([
    Promise.all(
      snapshots.map((snapshot) =>
        existsSync(snapshot.path) ? readFile(snapshot.path, "utf-8") : undefined
      )
    ),
    listSnapshotIds(config),
  ]);

  for (const [index, snapshot] of snapshots.entries()) {
    const current = contents[index];
    if (current === undefined) {
      status.missing.push(snapshot.id);
    } else if (current !== snapshot.content) {
      status.changed.push({ current, id: snapshot.id, next: snapshot.content });
    }
  }
  for (const id of onDisk) {
    if (!ids.has(id)) {
      status.orphaned.push(id);
    }
  }
  return status;
};

/** Writes changed and missing snapshots, and optionally deletes orphans. */
export const writeSnapshots = async (
  config: ResolvedConfig,
  snapshots: readonly Snapshot[],
  options: { prune?: boolean } = {}
): Promise<SnapshotStatus> => {
  const status = await compareSnapshots(config, snapshots);
  const toWrite = new Set([
    ...status.missing,
    ...status.changed.map((change) => change.id),
  ]);
  await mkdir(config.snapshotsDir, { recursive: true });
  await Promise.all([
    ...snapshots
      .filter((snapshot) => toWrite.has(snapshot.id))
      .map((snapshot) => writeFile(snapshot.path, snapshot.content)),
    ...(options.prune
      ? status.orphaned.map((id) => rm(snapshotPath(config, id)))
      : []),
  ]);
  return status;
};
