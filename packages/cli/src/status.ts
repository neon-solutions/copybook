import path from "node:path";

import { checkIssues } from "./analysis";
import type { Analysis } from "./analysis";
import { VERSION } from "./meta";
import { nextActions, runnerFor } from "./next-actions";
import type { NextAction } from "./next-actions";
import { readResults } from "./results";
import type { Issue } from "./validate";

interface RunSummary {
  failed: number;
  /** Ids with a failing case. */
  failing: string[];
  finishedAt: string;
  passed: number;
  skipped: number;
}

/** What `copybook status` reports: the project, and what needs doing. */
export interface StatusReport {
  /** True when there's nothing to do: `next` is empty. */
  clean: boolean;
  config: {
    content: string[];
    file: string;
    /** The directories of Markdown prompts. */
    markdown: string[];
    /** Declared placement names, or null when any placement is allowed. */
    placements: string[] | null;
    snapshotsDir: string;
    usage: string[] | null;
    verify: string[];
  };
  definitions: {
    command: number;
    prompt: number;
    snippet: number;
    total: number;
  };
  evals: (RunSummary & { cached: number; costUsd: number }) | null;
  issues: Issue[];
  name: string;
  next: NextAction[];
  ok: true;
  root: string;
  /** How to run the CLI here, such as `pnpm exec copybook`. */
  runner: string;
  schemaVersion: 1;
  snapshots: { changed: string[]; missing: string[]; orphaned: string[] };
  tests: RunSummary | null;
  unused: string[];
  version: string;
}

const failingIds = (results: readonly { id: string; status: string }[]) => [
  ...new Set(
    results
      .filter((result) => result.status === "fail")
      .map((result) => result.id)
  ),
];

const countStatus = (results: readonly { status: string }[], status: string) =>
  results.filter((result) => result.status === status).length;

export const buildStatus = async (
  analysis: Analysis
): Promise<StatusReport> => {
  const { config } = analysis.project;
  const [issues, results] = await Promise.all([
    checkIssues(analysis),
    readResults(config.root),
  ]);
  const relative = (file: string) =>
    path.relative(config.root, file).split(path.sep).join("/");
  const kinds = (kind: string) =>
    analysis.entries.filter((entry) => entry.kind === kind).length;
  const next = nextActions(issues, results);
  const { test, eval: evaluation } = results;

  return {
    clean: next.length === 0,
    config: {
      content: config.content ?? [],
      file: relative(config.file),
      markdown: config.markdown?.map((source) => source.dir) ?? [],
      placements: config.placements ? Object.keys(config.placements) : null,
      snapshotsDir: relative(config.snapshotsDir),
      usage: config.usage?.include ?? null,
      verify: config.verify ?? [],
    },
    definitions: {
      command: kinds("command"),
      prompt: kinds("prompt"),
      snippet: kinds("snippet"),
      total: analysis.entries.length,
    },
    evals: evaluation
      ? {
          cached: countStatus(evaluation.results, "cached"),
          costUsd: evaluation.costUsd,
          failed: countStatus(evaluation.results, "fail"),
          failing: failingIds(evaluation.results),
          finishedAt: evaluation.finishedAt,
          passed: countStatus(evaluation.results, "pass"),
          skipped: countStatus(evaluation.results, "skip"),
        }
      : null,
    issues,
    name: path.basename(config.root),
    next,
    ok: true,
    root: config.root,
    runner: runnerFor(config.root),
    schemaVersion: 1,
    snapshots: {
      changed: analysis.status.changed.map((change) => change.id),
      missing: analysis.status.missing,
      orphaned: analysis.status.orphaned,
    },
    tests: test
      ? {
          failed: countStatus(test.results, "fail"),
          failing: failingIds(test.results),
          finishedAt: test.finishedAt,
          passed: countStatus(test.results, "pass"),
          skipped: countStatus(test.results, "skip"),
        }
      : null,
    unused: analysis.usage?.unused ?? [],
    version: VERSION,
  };
};
