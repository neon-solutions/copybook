import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";

import { analyzeProject } from "../analysis";
import type { Analysis, DefinitionEntry } from "../analysis";
import { fileHistory } from "../git";
import type { Commit } from "../git";
import { loadProject } from "../load";
import type { Project } from "../load";
import { readResults } from "../results";
import type { Results } from "../results";
import { snapshotPath } from "../snapshot";
import type { Issue } from "../validate";

export type { SnapshotState } from "../analysis";

export type StudioEntry = DefinitionEntry;

export interface StudioManifest {
  definitions: StudioEntry[];
  issues: Issue[];
  loadedAt: string;
  name: string;
}

export interface StudioState {
  history: (id: string) => Promise<Commit[]>;
  /** The latest `test` and `eval` reports, if they exist. */
  results: () => Promise<Results>;
  manifest: () => StudioManifest;
  reload: () => Promise<void>;
  render: (
    id: string,
    values: Record<string, unknown>,
    variant?: string
  ) => { rendered: Rendered; text: string };
  project: () => Project;
}

const toManifest = (analysis: Analysis): StudioManifest => ({
  definitions: analysis.entries,
  issues: analysis.issues,
  loadedAt: analysis.loadedAt,
  name: path.basename(analysis.project.config.root),
});

/** Loads a project and keeps a manifest for Studio, reloading on demand. */
export const createStudioState = async (
  cwd: string,
  options: { config?: string }
): Promise<StudioState> => {
  let analysis = await analyzeProject(await loadProject(cwd, options));
  let manifest = toManifest(analysis);

  const find = (id: string) => {
    const loaded = analysis.project.definitions.find(
      ({ definition }) => definition.id === id
    );
    if (!loaded) {
      throw new Error(`No definition "${id}".`);
    }
    return loaded.definition;
  };

  return {
    history: (id) =>
      fileHistory(
        analysis.project.config.root,
        snapshotPath(analysis.project.config, id)
      ),
    manifest: () => manifest,
    project: () => analysis.project,
    reload: async () => {
      const next = await analyzeProject(await loadProject(cwd, options));
      manifest = toManifest(next);
      analysis = next;
    },
    render: (id, values, variant) => {
      const rendered = renderExample(find(id), {
        values,
        ...(variant ? { variant } : {}),
      });
      return { rendered, text: toText(rendered) };
    },
    results: () => readResults(analysis.project.config.root),
  };
};
