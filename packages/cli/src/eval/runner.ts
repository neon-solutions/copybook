import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { renderExample, toText } from "@copybook/core";
import type { AnyParam, Definition } from "@copybook/core";

import type { FixtureResult } from "../test/define";
import { baseEnv } from "../test/exec";
import { resolveAgent } from "./adapters";
import type { AgentAdapter } from "./adapters";
import type { EvalSpec } from "./define";
import { findCached, readHistory } from "./history";
import { installShims, readShimCalls } from "./shims";
import type {
  AssertionOutcome,
  EvalReport,
  EvalResult,
  EvalTrial,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15 * 60_000;

export interface EvalTarget {
  /** The rendered snapshot's hash, so unchanged prompts can be skipped. */
  contentHash: string;
  definition: Definition;
  spec: EvalSpec;
}

export interface EvalRunOptions {
  /** Only run these agents (by name). */
  agents?: readonly string[];
  /** Stop starting trials once this much has been spent. */
  budgetUsd?: number;
  /** Re-run even if history has a result for the same prompt and agent. */
  force?: boolean;
  historyDir?: string;
  onResult?: (result: EvalResult) => void;
  root: string;
  runId: string;
  /** Overrides each spec's trial count. */
  trials?: number;
}

const passthroughEnv = (agent: AgentAdapter) => {
  const env: Record<string, string> = {};
  for (const name of agent.env ?? []) {
    const value = process.env[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return env;
};

const promptValues = (
  definition: Definition,
  spec: EvalSpec,
  fixtureValue: unknown
) => {
  const values: Record<string, unknown> = {
    ...spec.options.params?.(fixtureValue),
  };
  for (const [name, param] of Object.entries(
    definition.params as Record<string, AnyParam>
  )) {
    if (
      param.state.kind === "secret" &&
      values[name] === undefined &&
      param.state.env
    ) {
      values[name] = process.env[param.state.env];
    }
  }
  return values;
};

interface TrialInput {
  agent: AgentAdapter;
  fixture?: FixtureResult<unknown>;
  options: EvalRunOptions;
  target: EvalTarget;
  trial: number;
}

const runTrial = async ({
  agent,
  fixture,
  options,
  target,
  trial,
}: TrialInput): Promise<EvalTrial> => {
  const { definition, spec } = target;
  const started = performance.now();
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "copybook-eval-"));
  try {
    const cwd = path.join(sandbox, "project");
    await mkdir(cwd, { recursive: true });
    if (spec.options.sandbox?.template) {
      await cp(path.resolve(options.root, spec.options.sandbox.template), cwd, {
        recursive: true,
      });
    }
    const shimDir = path.join(sandbox, "shims");
    const log = await installShims(shimDir, spec.options.shims ?? {});
    const base = baseEnv();
    const env = {
      ...base,
      ...passthroughEnv(agent),
      ...fixture?.env,
      ...spec.options.env,
      PATH: `${shimDir}${path.delimiter}${base.PATH ?? ""}`,
    };

    const rendered = renderExample(definition, {
      values: promptValues(definition, spec, fixture?.value),
    });
    const run = await agent.run({
      cwd,
      env,
      prompt: toText(rendered),
      rendered,
      timeoutMs: spec.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(spec.options.maxCostUsd === undefined
        ? {}
        : { maxCostUsd: spec.options.maxCostUsd }),
    });

    const transcripts = path.join(
      options.root,
      ".copybook",
      "results",
      "evals",
      definition.id
    );
    await mkdir(transcripts, { recursive: true });
    await writeFile(
      path.join(transcripts, `${agent.name}-${trial}.log`),
      run.transcript
    );

    const calls = await readShimCalls(log);
    const context = { agent: run, calls, cwd, env };
    const assertions: AssertionOutcome[] = [];
    for (const assertion of spec.options.assert) {
      // Assertions such as `succeeds` change the sandbox, so they run in order.
      // oxlint-disable-next-line no-await-in-loop
      const outcome = await Promise.resolve(assertion.check(context)).catch(
        (error: unknown) => ({
          message: error instanceof Error ? error.message : String(error),
          passed: false,
        })
      );
      assertions.push({ name: assertion.name, ...outcome });
    }

    return {
      agentExitCode: run.exitCode,
      assertions,
      calls: calls.map((call) => call.line),
      durationMs: Math.round(performance.now() - started),
      passed:
        !run.timedOut && assertions.every((assertion) => assertion.passed),
      timedOut: run.timedOut,
      trial,
      ...(run.costUsd === undefined ? {} : { costUsd: run.costUsd }),
    };
  } finally {
    await rm(sandbox, { force: true, recursive: true });
  }
};

const sum = (values: readonly number[]) => {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
};

interface RunState {
  fixtures: Map<string, FixtureResult<unknown>>;
  spent: number;
}

const failedTrial = (trial: number, error: unknown): EvalTrial => ({
  agentExitCode: null,
  assertions: [],
  calls: [],
  durationMs: 0,
  error: error instanceof Error ? error.message : String(error),
  passed: false,
  timedOut: false,
  trial,
});

/* oxlint-disable no-await-in-loop -- Trials run one at a time on purpose:
   agents are heavy, and the budget is checked before each one. */

const runTrials = async (
  input: Omit<TrialInput, "trial">,
  count: number,
  state: RunState
): Promise<EvalTrial[]> => {
  const trials: EvalTrial[] = [];
  for (let trial = 1; trial <= count; trial += 1) {
    const { budgetUsd } = input.options;
    if (budgetUsd !== undefined && state.spent >= budgetUsd) {
      break;
    }
    const result = await runTrial({ ...input, trial }).catch((error: unknown) =>
      failedTrial(trial, error)
    );
    state.spent += result.costUsd ?? 0;
    trials.push(result);
  }
  return trials;
};

const getFixture = async (
  target: EvalTarget,
  options: EvalRunOptions,
  state: RunState
) => {
  const { fixture } = target.spec.options;
  if (!fixture) {
    return;
  }
  if (!state.fixtures.has(fixture.id)) {
    state.fixtures.set(
      fixture.id,
      await fixture.setup({ runId: options.runId })
    );
  }
  return state.fixtures.get(fixture.id);
};

const evaluateAgent = async (
  target: EvalTarget,
  agent: AgentAdapter,
  history: Awaited<ReturnType<typeof readHistory>>,
  options: EvalRunOptions,
  state: RunState
): Promise<EvalResult> => {
  const threshold = target.spec.options.passRate ?? 1;
  const base = {
    agent: agent.name,
    contentHash: target.contentHash,
    id: target.spec.id,
    threshold,
  };
  const empty = { costUsd: 0, passRate: 0, trials: [] };
  if (!(await agent.available())) {
    return {
      ...base,
      ...empty,
      agentVersion: "",
      reason: `${agent.name} isn't installed`,
      status: "skip",
    };
  }
  const agentVersion = await agent.version();
  const cached = options.force
    ? undefined
    : findCached(history, { ...base, agentVersion });
  if (cached) {
    return {
      ...base,
      ...empty,
      agentVersion,
      passRate: cached.passRate,
      reason: `unchanged since ${cached.date}`,
      status: "cached",
    };
  }

  const fixture = await getFixture(target, options, state);
  const count = options.trials ?? target.spec.options.trials ?? 1;
  const trials = await runTrials(
    { agent, options, target, ...(fixture ? { fixture } : {}) },
    count,
    state
  );
  const costUsd = sum(trials.map((trial) => trial.costUsd ?? 0));
  if (trials.length === 0) {
    return {
      ...base,
      ...empty,
      agentVersion,
      reason: "budget exhausted",
      status: "skip",
    };
  }
  const passRate =
    trials.filter((trial) => trial.passed).length / trials.length;
  return {
    ...base,
    agentVersion,
    costUsd,
    passRate,
    status: passRate >= threshold ? "pass" : "fail",
    trials,
  };
};

/** Runs every eval × agent × trial, one trial at a time, within the budget. */
export const runEvals = async (
  targets: readonly EvalTarget[],
  options: EvalRunOptions
): Promise<EvalReport> => {
  const startedAt = new Date().toISOString();
  const results: EvalResult[] = [];
  const state: RunState = { fixtures: new Map(), spent: 0 };

  try {
    for (const target of targets) {
      const history = options.historyDir
        ? await readHistory(options.historyDir, target.spec.id)
        : [];
      const agents = target.spec.options.agents
        .map(resolveAgent)
        .filter(
          (agent) => !options.agents || options.agents.includes(agent.name)
        );
      for (const agent of agents) {
        const result = await evaluateAgent(
          target,
          agent,
          history,
          options,
          state
        );
        results.push(result);
        options.onResult?.(result);
      }
    }
  } finally {
    await Promise.allSettled(
      [...state.fixtures.values()].map((fixture) => fixture.teardown?.())
    );
  }

  return {
    costUsd: state.spent,
    finishedAt: new Date().toISOString(),
    results,
    runId: options.runId,
    startedAt,
  };
};

/* oxlint-enable no-await-in-loop */
