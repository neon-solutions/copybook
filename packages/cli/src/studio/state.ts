import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";

import { RESULTS_DIR } from "../commands/test";
import { fileHistory } from "../git";
import type { Commit } from "../git";
import { loadProject } from "../load";
import type { Project } from "../load";
import { buildManifest } from "../manifest";
import type { ManifestEntry } from "../manifest";
import { compareSnapshots, snapshotPath } from "../snapshot";
import { findUsages } from "../usages";
import { buildSnapshots } from "../validate";
import type { Issue } from "../validate";

export type SnapshotState = "changed" | "missing" | "up-to-date";

export interface StudioEntry extends ManifestEntry {
  /** Product files that import it, when `usage` is configured. */
  renderedIn: string[];
  snapshot: SnapshotState;
  /** Ids of definitions that embed this one. */
  usedBy: string[];
}

export interface StudioManifest {
  definitions: StudioEntry[];
  issues: Issue[];
  loadedAt: string;
  name: string;
}

export interface StudioResults {
  eval?: unknown;
  test?: unknown;
}

export interface StudioState {
  history: (id: string) => Promise<Commit[]>;
  /** The latest `test` and `eval` reports, if they exist. */
  results: () => Promise<StudioResults>;
  manifest: () => StudioManifest;
  reload: () => Promise<void>;
  render: (
    id: string,
    values: Record<string, unknown>,
    variant?: string
  ) => { rendered: Rendered; text: string };
  project: () => Project;
}

const reverseEmbeds = (entries: readonly ManifestEntry[]) => {
  const usedBy = new Map<string, string[]>();
  for (const entry of entries) {
    for (const embedded of entry.embeds) {
      usedBy.set(embedded, [...(usedBy.get(embedded) ?? []), entry.id]);
    }
  }
  return usedBy;
};

const buildStudioManifest = async (
  project: Project
): Promise<StudioManifest> => {
  const { issues, snapshots } = buildSnapshots(project);
  const status = await compareSnapshots(project.config, snapshots);
  const missing = new Set(status.missing);
  const changed = new Set(status.changed.map((change) => change.id));
  const { definitions } = buildManifest(project.definitions, snapshots);
  const usedBy = reverseEmbeds(definitions);
  const usage = await findUsages(
    project,
    new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.embeds]))
  );

  const snapshotState = (id: string): SnapshotState => {
    if (missing.has(id)) {
      return "missing";
    }
    return changed.has(id) ? "changed" : "up-to-date";
  };

  return {
    definitions: definitions.map((entry) => ({
      ...entry,
      renderedIn: usage?.usages[entry.id] ?? [],
      snapshot: snapshotState(entry.id),
      usedBy: usedBy.get(entry.id) ?? [],
    })),
    issues,
    loadedAt: new Date().toISOString(),
    name: path.basename(project.config.root),
  };
};

const readJson = async (file: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as unknown;
  } catch {
    return null;
  }
};

/** Loads a project and keeps a manifest for Studio, reloading on demand. */
export const createStudioState = async (
  cwd: string,
  options: { config?: string }
): Promise<StudioState> => {
  let project = await loadProject(cwd, options);
  let manifest = await buildStudioManifest(project);

  const find = (id: string) => {
    const loaded = project.definitions.find(
      ({ definition }) => definition.id === id
    );
    if (!loaded) {
      throw new Error(`No definition "${id}".`);
    }
    return loaded.definition;
  };

  return {
    history: (id) =>
      fileHistory(project.config.root, snapshotPath(project.config, id)),
    manifest: () => manifest,
    project: () => project,
    reload: async () => {
      const next = await loadProject(cwd, options);
      manifest = await buildStudioManifest(next);
      project = next;
    },
    render: (id, values, variant) => {
      const rendered = renderExample(find(id), {
        values,
        ...(variant ? { variant } : {}),
      });
      return { rendered, text: toText(rendered) };
    },
    results: async () => {
      const dir = path.join(project.config.root, RESULTS_DIR);
      const read = (file: string) => readJson(path.join(dir, file));
      const [test, evaluation] = await Promise.all([
        read("test.json"),
        read("eval.json"),
      ]);
      return {
        ...(test ? { test } : {}),
        ...(evaluation ? { eval: evaluation } : {}),
      };
    },
  };
};
