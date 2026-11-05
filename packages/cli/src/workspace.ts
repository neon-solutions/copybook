import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";

import { analyzeProject } from "./analysis";
import type { Analysis } from "./analysis";
import { definitionDetail, requireDefinition } from "./detail";
import type { DefinitionDetail } from "./detail";
import { CopybookError } from "./errors";
import { fileHistory } from "./git";
import type { Commit } from "./git";
import { loadProject } from "./load";
import type { Project } from "./load";
import { readResults } from "./results";
import type { Results } from "./results";
import { snapshotFile, writeSnapshots } from "./snapshot";
import { buildStatus } from "./status";
import type { StatusReport } from "./status";
import { runProjectTests } from "./test/run-project";
import type { ProjectTestOptions, ProjectTestRun } from "./test/run-project";
import type { Issue } from "./validate";

const IGNORED_SEGMENTS = new Set([
  ".copybook",
  ".git",
  ".next",
  "dist",
  "node_modules",
]);
const RELOAD_DEBOUNCE_MS = 150;

export type WorkspaceEvent =
  | { loadedAt: string; type: "change" }
  | { message: string; type: "error" };

/**
 * A loaded project that stays current: Studio and the MCP server share it.
 * File changes mark it stale, and the next read reloads it. Reloads and
 * writes run one at a time, in order.
 */
export interface Workspace {
  close: () => void;
  current: () => Promise<Analysis>;
  definition: (
    id: string,
    options?: { values?: Record<string, unknown>; variant?: string }
  ) => Promise<DefinitionDetail>;
  history: (id: string) => Promise<Commit[]>;
  onChange: (listener: (event: WorkspaceEvent) => void) => () => void;
  /** Runs `task` after pending reloads, then reloads, for writes. */
  queue: <T>(task: (analysis: Analysis) => Promise<T>) => Promise<T>;
  reload: () => Promise<Analysis>;
  render: (
    id: string,
    values: Record<string, unknown>,
    variant?: string
  ) => Promise<{ rendered: Rendered; text: string }>;
  results: () => Promise<Results>;
  root: () => string;
  /**
   * Runs tests against the current project, outside the queue, so Studio
   * stays responsive during long typecheck installs.
   */
  runTests: (options: ProjectTestOptions) => Promise<ProjectTestRun>;
  status: () => Promise<StatusReport>;
  /** Watches the project, so edits show up without a restart. */
  watch: () => void;
  writeSnapshots: (options?: { prune?: boolean }) => Promise<SnapshotWrite>;
}

/** What `writeSnapshots` changed, like `copybook snapshot --json`. */
export interface SnapshotWrite {
  issues: Issue[];
  written: {
    added: string[];
    orphaned: string[];
    removed: string[];
    updated: string[];
  };
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export interface WorkspaceOptions {
  config?: string;
  cwd: string;
  /** Loads the project. Tests use it to point snapshots at a temp dir. */
  load?: () => Promise<Project>;
}

export const openWorkspace = async (
  options: WorkspaceOptions
): Promise<Workspace> => {
  const load =
    options.load ??
    (() =>
      loadProject(
        options.cwd,
        options.config ? { config: options.config } : {}
      ));
  let analysis = await analyzeProject(await load());
  let stale = false;
  let chain: Promise<unknown> = Promise.resolve();
  let watcher: FSWatcher | undefined;
  let timer: NodeJS.Timeout | undefined;
  const listeners = new Set<(event: WorkspaceEvent) => void>();
  const emit = (event: WorkspaceEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  /** Runs tasks one at a time, in the order they were queued. */
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    // The next task waits for this one, whether it fails or not.
    chain = run.then(
      () => true,
      () => false
    );
    return run;
  };

  const reload = () =>
    serialize(async () => {
      stale = false;
      analysis = await analyzeProject(await load());
      return analysis;
    });

  const current = (): Promise<Analysis> =>
    stale ? reload() : Promise.resolve(analysis);

  const workspace: Workspace = {
    close: () => {
      clearTimeout(timer);
      watcher?.close();
      listeners.clear();
    },
    current,
    definition: async (id, detailOptions = {}) => {
      const latest = await current();
      return definitionDetail(latest, id, {
        ...detailOptions,
        results: await readResults(latest.project.config.root),
      });
    },
    history: async (id) => {
      const latest = await current();
      const { entry } = requireDefinition(latest, id);
      return fileHistory(
        latest.project.config.root,
        snapshotFile(latest.project.config, latest.snapshots, entry.id)
      );
    },
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    queue: async (task) => {
      const result = await serialize(async () => task(await current()));
      stale = true;
      const latest = await current();
      emit({ loadedAt: latest.loadedAt, type: "change" });
      return result;
    },
    reload,
    render: async (id, values, variant) => {
      const { definition } = requireDefinition(await current(), id).loaded;
      try {
        const rendered = renderExample(definition, {
          values,
          ...(variant ? { variant } : {}),
        });
        return { rendered, text: toText(rendered) };
      } catch (error) {
        throw new CopybookError("INVALID_VALUES", errorMessage(error));
      }
    },
    results: async () => {
      const latest = await current();
      return readResults(latest.project.config.root);
    },
    root: () => analysis.project.config.root,
    runTests: async (testOptions) => {
      const latest = await current();
      return runProjectTests(latest.project, testOptions);
    },
    status: async () => buildStatus(await current()),
    watch: () => {
      if (watcher) {
        return;
      }
      watcher = watch(
        analysis.project.config.root,
        { recursive: true },
        (_event, file) => {
          const segments = String(file ?? "").split(path.sep);
          if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) {
            return;
          }
          stale = true;
          clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const latest = await current();
              emit({ loadedAt: latest.loadedAt, type: "change" });
            } catch (error) {
              emit({ message: errorMessage(error), type: "error" });
            }
          }, RELOAD_DEBOUNCE_MS);
        }
      );
    },
    writeSnapshots: (snapshotOptions = {}) =>
      workspace.queue(async (latest) => {
        const status = await writeSnapshots(
          latest.project.config,
          latest.snapshots,
          snapshotOptions
        );
        return {
          issues: latest.issues,
          written: {
            added: status.missing,
            orphaned: snapshotOptions.prune ? [] : status.orphaned,
            removed: snapshotOptions.prune ? status.orphaned : [],
            updated: status.changed.map((change) => change.id),
          },
        };
      }),
  };
  return workspace;
};
