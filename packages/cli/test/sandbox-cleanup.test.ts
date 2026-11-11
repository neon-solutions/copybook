import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineCommand, definePrompt, p } from "@copybook/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentAdapter } from "../src/eval/adapters";
import { scriptAgent } from "../src/eval/adapters";
import { defineEval } from "../src/eval/define";
import { runEvals } from "../src/eval/runner";
import type { EvalRunOptions, EvalTarget } from "../src/eval/runner";
import { defineTest } from "../src/test/define";
import { exec } from "../src/test/exec";
import { buildPlan } from "../src/test/plan";
import { runTests } from "../src/test/runner";
import { npmSandbox } from "../src/test/sandbox";

vi.mock(import("../src/test/exec"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, exec: vi.fn<typeof actual.exec>(actual.exec) };
});

/** Points `os.tmpdir()` at a directory only the calling suite writes to. */
const isolateTmpdir = () => {
  let dir = "";
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "copybook-cleanup-"));
    vi.stubEnv("TMPDIR", dir);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { force: true, recursive: true });
  });
};

const loaded = (
  definition: Parameters<typeof buildPlan>[0][number]["definition"]
) => ({
  definition,
  exportName: "x",
  file: "x.ts",
});

const tmpNames = async (isMatch: (name: string) => boolean) => {
  const names = await readdir(os.tmpdir());
  return names.filter(isMatch);
};

const evalOptions = async (): Promise<EvalRunOptions> => ({
  root: await mkdtemp(path.join(os.tmpdir(), "copybook-eval-root-")),
  runId: "cleanup-eval",
});

const isRunSandbox = (name: string) => name.startsWith("copybook-run-");

const isEvalSandbox = (name: string) =>
  name.startsWith("copybook-eval-") &&
  !name.startsWith("copybook-eval-root-") &&
  !name.startsWith("copybook-eval-history-");

describe("run sandbox cleanup", () => {
  isolateTmpdir();

  const echo = defineCommand({
    id: "cleanup.echo",
    template: () => "echo ok",
    verify: "run",
  });

  it("removes copybook-run-* dirs after a passing case", async () => {
    const spec = defineTest(echo, { expect: { stdout: "ok" } });
    const [plan] = buildPlan([loaded(echo)], [spec], ["run"]);

    const report = await runTests(plan ? [plan] : [], {
      concurrency: 1,
      root: os.tmpdir(),
      runId: "cleanup-pass",
    });
    const created = await tmpNames(isRunSandbox);

    expect(report.results).toMatchObject([{ status: "pass", tier: "run" }]);
    expect(created).toStrictEqual([]);
  });

  it("removes copybook-run-* dirs after a failed or timed-out case", async () => {
    const hang = defineCommand({
      id: "cleanup.hang",
      template: () => "sleep 30",
      verify: "run",
    });
    const failSpec = defineTest(echo, { expect: { stdout: "nope" } });
    const timeoutSpec = defineTest(hang, { timeoutMs: 50 });
    const cases = buildPlan(
      [loaded(echo), loaded(hang)],
      [failSpec, timeoutSpec],
      ["run"]
    );

    const report = await runTests(cases, {
      concurrency: 2,
      root: os.tmpdir(),
      runId: "cleanup-fail",
    });
    const created = await tmpNames(isRunSandbox);

    expect(report.results.map((result) => result.status)).toStrictEqual([
      "fail",
      "fail",
    ]);
    expect(created).toStrictEqual([]);
  });
});

describe("eval sandbox cleanup", () => {
  isolateTmpdir();

  const prompt = definePrompt({
    id: "cleanup.eval",
    params: { projectId: p.string().example("proj-1") },
    template: (t, { projectId }) => t`Run acme init --project-id ${projectId}.`,
  });

  const target = (agent: AgentAdapter): EvalTarget => ({
    contentHash: "hash-cleanup",
    definition: prompt,
    spec: defineEval(prompt, { agents: [agent], assert: [] }),
  });

  it("removes copybook-eval-* dirs after a trial, including thrown runs", async () => {
    const follows = scriptAgent("follows", () => "true");
    const exploding: AgentAdapter = {
      ...follows,
      name: "exploding",
      run: () => Promise.reject(new Error("boom")),
    };

    const report = await runEvals(
      [target(follows), target(exploding)],
      await evalOptions()
    );
    const created = await tmpNames(isEvalSandbox);

    expect(report.results.map((result) => result.status)).toStrictEqual([
      "pass",
      "fail",
    ]);
    expect(report.results[1]?.trials[0]?.error).toBe("boom");
    expect(created).toStrictEqual([]);
  });
});

describe(npmSandbox, () => {
  isolateTmpdir();

  const failure = {
    code: 1,
    durationMs: 0,
    output: "offline",
    stderr: "offline",
    stdout: "",
    timedOut: false,
  };

  it("retries after a failed install instead of caching the rejection", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "copybook-sandbox-root-")
    );
    const packages = ["copybook-retry-pkg"];
    vi.mocked(exec)
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce({ ...failure, code: 0, output: "" });
    const first = npmSandbox(root, packages);

    await expect(first).rejects.toThrow(/npm install/u);

    const second = npmSandbox(root, packages);

    expect(second).not.toBe(first);
    await expect(second).resolves.toContain(root);
    expect(exec).toHaveBeenCalledTimes(2);
  });
});
