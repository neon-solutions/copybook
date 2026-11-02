import { describe, expect, it } from "vitest";

import { nextActions } from "../src/next-actions";
import type { TestReport } from "../src/test/types";
import type { Issue } from "../src/validate";

const issue = (code: Issue["code"], id: string): Issue => ({
  code,
  id,
  level: "error",
  message: "",
});

const report = (statuses: TestReport["results"][number]["status"][]) =>
  ({
    finishedAt: "",
    results: statuses.map((status, index) => ({
      durationMs: 0,
      id: `cli.${index}`,
      status,
      tier: "syntax",
    })),
    runId: "test",
    startedAt: "",
    tiers: ["syntax"],
  }) satisfies TestReport;

describe(nextActions, () => {
  it("orders fixes before snapshots and keeps destructive steps unsafe", () => {
    const actions = nextActions([
      issue("snapshot-orphaned", "old.id"),
      issue("snapshot-changed", "cli.deploy"),
      issue("render-failed", "cli.init"),
    ]);

    expect(actions.map((action) => action.code)).toStrictEqual([
      "fix-definitions",
      "write-snapshots",
      "prune-snapshots",
    ]);
    expect(actions[1]).toMatchObject({
      argv: ["snapshot"],
      ids: ["cli.deploy"],
      safe: true,
    });
    expect(actions[2]?.safe).toBeFalsy();
  });

  it("reruns only the failing tests, or suggests a first run", () => {
    expect(nextActions([], { test: report(["pass", "fail"]) })).toStrictEqual([
      expect.objectContaining({
        argv: ["test", "--only", "cli.1"],
        code: "fix-tests",
      }),
    ]);
    expect(nextActions([], {})[0]?.code).toBe("run-tests");
    expect(nextActions([], { test: report(["pass"]) })).toStrictEqual([]);
  });
});
