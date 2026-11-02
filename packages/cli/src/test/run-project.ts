import { randomBytes } from "node:crypto";
import os from "node:os";

import { changedIds } from "../changes";
import type { Project } from "../load";
import { writeResults } from "../results";
import { buildSnapshots } from "../validate";
import type { Tier } from "./define";
import { loadTestSpecs } from "./load";
import { buildPlan } from "./plan";
import { runTests } from "./runner";
import type { TestReport, TestResult } from "./types";

export interface ProjectTestOptions {
  /** With `changed`, the git ref to compare against. */
  base?: string;
  changed?: boolean;
  concurrency?: number;
  ids?: readonly string[];
  onResult?: (result: TestResult) => void;
  /** Defaults to a random id. */
  runId?: string;
  tiers: readonly Tier[];
}

export interface ProjectTestRun {
  /** How many cases ran. */
  cases: number;
  report: TestReport;
  /** Ids in `ids` that match no definition. */
  unknownIds: string[];
}

const defaultConcurrency = () =>
  Math.max(1, Math.floor(os.availableParallelism() / 2));

/**
 * Loads the project's test specs, selects definitions, runs every case, and
 * saves the report under `.copybook/results`.
 */
export const runProjectTests = async (
  project: Project,
  options: ProjectTestOptions
): Promise<ProjectTestRun> => {
  const specs = await loadTestSpecs(project.config);

  let { definitions } = project;
  if (options.changed) {
    const { snapshots } = buildSnapshots(project);
    const ids = new Set(
      await changedIds(project, snapshots, options.base ?? "HEAD")
    );
    definitions = definitions.filter(({ definition }) =>
      ids.has(definition.id)
    );
  }
  const known = new Set(
    project.definitions.map(({ definition }) => definition.id)
  );
  const unknownIds = (options.ids ?? []).filter((id) => !known.has(id));
  if (options.ids) {
    const only = new Set(options.ids);
    definitions = definitions.filter(({ definition }) =>
      only.has(definition.id)
    );
  }

  const cases = buildPlan(definitions, specs, [...options.tiers]);
  const report = await runTests(cases, {
    concurrency: options.concurrency ?? defaultConcurrency(),
    ...(options.onResult ? { onResult: options.onResult } : {}),
    root: project.config.root,
    runId: options.runId ?? randomBytes(4).toString("hex"),
  });
  await writeResults(project.config.root, "test", report);
  return { cases: cases.length, report, unknownIds };
};
