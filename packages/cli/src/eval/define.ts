import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  InputValues,
  ParamsShape,
  PromptDefinition,
} from "@copybook/core";

import type { Fixture } from "../test/define";
import { exec } from "../test/exec";
import type { ExecResult } from "../test/exec";
import type { AgentAdapter, AgentRun } from "./adapters";
import type { Shim, ShimCall } from "./shims";

export const EVAL = Symbol.for("copybook.eval");

export interface AssertContext {
  agent: AgentRun;
  /** Every call to a shimmed binary, in order. */
  calls: ShimCall[];
  cwd: string;
  env: Record<string, string>;
}

export interface AssertResult {
  message?: string;
  passed: boolean;
}

export interface Assertion {
  check: (context: AssertContext) => AssertResult | Promise<AssertResult>;
  name: string;
}

const matches = (line: string, pattern: RegExp | string) =>
  typeof pattern === "string" ? line.includes(pattern) : pattern.test(line);

const describePattern = (pattern: RegExp | string) =>
  typeof pattern === "string" ? JSON.stringify(pattern) : String(pattern);

const callList = (calls: readonly ShimCall[]) =>
  calls.length === 0
    ? "no shimmed commands ran"
    : `ran: ${calls.map((call) => call.line).join(" | ")}`;

/** A shimmed command matching `pattern` ran. */
export const ran = (pattern: RegExp | string): Assertion => ({
  check: ({ calls }) => {
    const passed = calls.some((call) => matches(call.line, pattern));
    return passed ? { passed } : { message: callList(calls), passed };
  },
  name: `ran ${describePattern(pattern)}`,
});

/** No shimmed command matching `pattern` ran. */
export const notRan = (pattern: RegExp | string): Assertion => ({
  check: ({ calls }) => {
    const call = calls.find((item) => matches(item.line, pattern));
    return call
      ? { message: `ran ${call.line}`, passed: false }
      : { passed: true };
  },
  name: `didn't run ${describePattern(pattern)}`,
});

/** Shimmed commands matching each pattern ran in this order (others may run in between). */
export const ranInOrder = (
  patterns: readonly (RegExp | string)[]
): Assertion => ({
  check: ({ calls }) => {
    let next = 0;
    for (const call of calls) {
      const pattern = patterns[next];
      if (pattern !== undefined && matches(call.line, pattern)) {
        next += 1;
      }
    }
    const missing = patterns[next];
    return missing === undefined
      ? { passed: true }
      : {
          message: `never got to ${describePattern(missing)}; ${callList(calls)}`,
          passed: false,
        };
  },
  name: `ran in order: ${patterns.map(describePattern).join(", ")}`,
});

/** A file exists in the sandbox. */
export const fileExists = (file: string): Assertion => ({
  check: ({ cwd }) => ({ passed: existsSync(path.join(cwd, file)) }),
  name: `${file} exists`,
});

/** A file in the sandbox matches `pattern`. */
export const fileContains = (
  file: string,
  pattern: RegExp | string
): Assertion => ({
  check: async ({ cwd }) => {
    const content = await readFile(path.join(cwd, file), "utf-8").catch(
      () => null
    );
    if (content === null) {
      return { message: `${file} doesn't exist`, passed: false };
    }
    return { passed: matches(content, pattern) };
  },
  name: `${file} contains ${describePattern(pattern)}`,
});

/** A shell command run in the sandbox after the agent finishes exits with `exitCode`. */
export const succeeds = (
  command: string,
  options: { exitCode?: number; timeoutMs?: number } = {}
): Assertion => ({
  check: async ({ cwd, env }) => {
    const result: ExecResult = await exec(
      "bash",
      ["-eo", "pipefail", "-c", command],
      {
        cwd,
        env,
        timeoutMs: options.timeoutMs ?? 5 * 60_000,
      }
    );
    const expected = options.exitCode ?? 0;
    return result.code === expected
      ? { passed: true }
      : {
          message: `exited with ${result.code}: ${result.output.trim().split("\n").slice(-10).join("\n")}`,
          passed: false,
        };
  },
  name: `\`${command}\` succeeds`,
});

/** A custom check. */
export const assertThat = (
  name: string,
  check: Assertion["check"]
): Assertion => ({ check, name });

export interface EvalOptions<S extends ParamsShape, V> {
  /** Agents by name (`claude-code`, `codex`, `literal`) or adapters. */
  agents: readonly (AgentAdapter | string)[];
  assert: readonly Assertion[];
  /** Extra environment variables for the agent and assertions. */
  env?: Record<string, string>;
  fixture?: Fixture<V>;
  /** Passed to adapters that support a per-run spend cap. */
  maxCostUsd?: number;
  params?: (fixture: V) => Partial<InputValues<S>>;
  /** The share of trials that must pass. Defaults to 1. */
  passRate?: number;
  sandbox?: {
    /** A directory, relative to the config, copied into each trial's sandbox. */
    template?: string;
  };
  /** Binaries to record (and optionally stub) during the agent run. */
  shims?: Readonly<Record<string, Shim>>;
  timeoutMs?: number;
  /** How many times each agent runs the prompt. Defaults to 1. */
  trials?: number;
}

export interface EvalSpec {
  readonly [EVAL]: true;
  readonly id: string;
  readonly options: EvalOptions<ParamsShape, unknown>;
}

/** Evaluates a prompt by giving it to coding agents and checking what they did. */
export const defineEval = <S extends ParamsShape, V = undefined>(
  /** The prompt, or its id, such as a Markdown prompt's `site.prompts.setup`. */
  prompt: PromptDefinition<S> | string,
  options: NoInfer<EvalOptions<S, V>> & { fixture?: Fixture<V> }
): EvalSpec =>
  Object.freeze({
    [EVAL]: true as const,
    id: typeof prompt === "string" ? prompt : prompt.id,
    options: options as EvalOptions<ParamsShape, unknown>,
  });

export const isEvalSpec = (value: unknown): value is EvalSpec =>
  typeof value === "object" && value !== null && EVAL in value;
