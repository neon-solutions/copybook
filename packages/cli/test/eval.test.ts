import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineCommand, definePrompt, p } from "@prompt-manager/core";
import { describe, expect, it } from "vitest";

import { literal, scriptAgent } from "../src/eval/adapters";
import type { AgentAdapter } from "../src/eval/adapters";
import {
  defineEval,
  fileExists,
  notRan,
  ran,
  ranInOrder,
  succeeds,
} from "../src/eval/define";
import { runEvals } from "../src/eval/runner";
import type { EvalRunOptions, EvalTarget } from "../src/eval/runner";

const init = defineCommand({
  id: "eval.init",
  params: { projectId: p.string().example("proj-1") },
  template: (t, { projectId }) => t`acme init --project-id ${projectId}`,
});

const prompt = definePrompt({
  id: "eval.setup",
  params: { projectId: p.string().example("proj-1") },
  template: (t, params) => t`
    1. ${t.cmd(init, params)}
    2. ${t.cmd("acme deploy")}
  `,
});

// The fake CLI writes acme.ts on init, like the real one would.
const shims = {
  acme: {
    script: 'if [ "$1" = init ]; then echo "export default {};" > acme.ts; fi',
  },
};

const assertions = [
  ranInOrder([/acme init --project-id proj-1/u, "acme deploy"]),
  notRan("acme login"),
  fileExists("acme.ts"),
  succeeds("test -s acme.ts"),
];

const target = (
  agents: EvalTarget["spec"]["options"]["agents"],
  trials = 1
): EvalTarget => ({
  contentHash: "hash-1",
  definition: prompt,
  spec: defineEval(prompt, { agents, assert: assertions, shims, trials }),
});

const options = async (
  extra: Partial<EvalRunOptions> = {}
): Promise<EvalRunOptions> => ({
  root: await mkdtemp(path.join(os.tmpdir(), "pm-eval-root-")),
  runId: "test",
  ...extra,
});

const followsPrompt = scriptAgent(
  "follows",
  () => "acme init --project-id proj-1\nacme deploy"
);
const skipsInit = scriptAgent("skips-init", () => "acme deploy");

describe(runEvals, () => {
  it("passes when the agent does what the prompt says", async () => {
    const report = await runEvals(
      [target([followsPrompt, literal()])],
      await options()
    );

    expect(
      report.results.map((result) => [
        result.agent,
        result.status,
        result.passRate,
      ])
    ).toStrictEqual([
      ["follows", "pass", 1],
      ["literal", "pass", 1],
    ]);
    expect(report.results[0]?.trials[0]?.calls).toStrictEqual([
      "acme init --project-id proj-1",
      "acme deploy",
    ]);
  });

  it("fails with the assertions that didn't hold", async () => {
    const report = await runEvals([target([skipsInit], 2)], await options());
    const [result] = report.results;

    expect(result).toMatchObject({ passRate: 0, status: "fail" });
    expect(
      result?.trials[0]?.assertions
        .filter((item) => !item.passed)
        .map((item) => item.name)
    ).toStrictEqual([
      'ran in order: /acme init --project-id proj-1/u, "acme deploy"',
      "acme.ts exists",
      "`test -s acme.ts` succeeds",
    ]);
  });

  it("skips agents that aren't installed", async () => {
    const missing: AgentAdapter = {
      ...followsPrompt,
      available: () => Promise.resolve(false),
      name: "missing",
    };
    const report = await runEvals([target([missing])], await options());

    expect(report.results[0]).toMatchObject({
      reason: "missing isn't installed",
      status: "skip",
    });
  });

  it("stops starting trials once the budget is spent", async () => {
    const costly: AgentAdapter = {
      ...followsPrompt,
      name: "costly",
      run: async (input) => ({
        ...(await followsPrompt.run(input)),
        costUsd: 1,
      }),
    };
    const report = await runEvals(
      [target([costly], 3)],
      await options({ budgetUsd: 1.5 })
    );

    expect(report.results[0]?.trials).toHaveLength(2);
    expect(report.costUsd).toBe(2);
  });

  it("reuses history for an unchanged prompt and agent", async () => {
    const historyDir = await mkdtemp(
      path.join(os.tmpdir(), "pm-eval-history-")
    );
    const { appendHistory } = await import("../src/eval/history");
    const first = await runEvals([target([followsPrompt])], await options());
    const [result] = first.results;
    if (result) {
      await appendHistory(historyDir, result, {
        date: "2026-10-26",
        runId: "a",
      });
    }
    const second = await runEvals(
      [target([followsPrompt])],
      await options({ historyDir })
    );

    expect(second.results[0]).toMatchObject({ passRate: 1, status: "cached" });
  });

  it("records every shimmed call, even ones that ran", async () => {
    const report = await runEvals(
      [
        {
          ...target([scriptAgent("login", () => "acme login")]),
          spec: defineEval(prompt, {
            agents: [scriptAgent("login", () => "acme login")],
            assert: [ran("acme login"), notRan("acme login")],
            shims,
          }),
        },
      ],
      await options()
    );

    expect(
      report.results[0]?.trials[0]?.assertions.map((item) => item.passed)
    ).toStrictEqual([true, false]);
  });
});
