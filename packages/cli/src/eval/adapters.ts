import { collectCommands } from "@copybook/core";
import type { Rendered } from "@copybook/core";

import { exec, hasCommand } from "../test/exec";

export interface AgentInput {
  cwd: string;
  env: Record<string, string>;
  maxCostUsd?: number;
  prompt: string;
  rendered: Rendered;
  timeoutMs: number;
}

export interface AgentRun {
  costUsd?: number;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  /** Raw agent output, saved next to the results. */
  transcript: string;
}

export interface AgentAdapter {
  /** Checks that the agent is installed. */
  available: () => Promise<boolean>;
  /** Environment variables passed through to the agent, such as API keys. */
  env?: readonly string[];
  name: string;
  run: (input: AgentInput) => Promise<AgentRun>;
  /** Recorded with every result, so changes in the agent show up in history. */
  version: () => Promise<string>;
}

const versionOf = async (command: string) => {
  const result = await exec(command, ["--version"], {
    cwd: process.cwd(),
    timeoutMs: 15_000,
  });
  return result.code === 0 ? result.stdout.trim() : "unknown";
};

interface CliAgentOptions {
  /** Extra arguments appended to the agent's command line. */
  args?: readonly string[];
  model?: string;
}

const parseEvent = (line: string): { total_cost_usd?: number } | null => {
  try {
    return JSON.parse(line) as { total_cost_usd?: number };
  } catch {
    return null;
  }
};

/** Total cost from Claude Code's final `result` event in stream-json output. */
const claudeCost = (output: string): number | undefined => {
  const line = output
    .split("\n")
    .findLast((item) => item.includes('"type":"result"'));
  return line ? parseEvent(line)?.total_cost_usd : undefined;
};

/**
 * Claude Code in print mode. Permissions are bypassed and hooks and plugins
 * are skipped (`--bare`), so only run it in a disposable environment.
 */
export const claudeCode = (options: CliAgentOptions = {}): AgentAdapter => ({
  available: () => hasCommand("claude"),
  env: [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_BASE_URL",
    "AWS_ACCESS_KEY_ID",
    "AWS_REGION",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
  ],
  name: "claude-code",
  run: async (input) => {
    const args = [
      "-p",
      input.prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
      "--bare",
      "--no-session-persistence",
      ...(input.maxCostUsd === undefined
        ? []
        : ["--max-budget-usd", String(input.maxCostUsd)]),
      ...(options.model ? ["--model", options.model] : []),
      ...(options.args ?? []),
    ];
    const result = await exec("claude", args, {
      cwd: input.cwd,
      env: input.env,
      timeoutMs: input.timeoutMs,
    });
    const costUsd = claudeCost(result.stdout);
    return {
      ...(costUsd === undefined ? {} : { costUsd }),
      durationMs: result.durationMs,
      exitCode: result.code,
      timedOut: result.timedOut,
      transcript: result.output,
    };
  },
  version: () => versionOf("claude"),
});

/**
 * OpenAI's Codex CLI in non-interactive mode, with approvals and its sandbox
 * bypassed. Check the flags against your Codex version and override them
 * with `args` if needed.
 */
export const codex = (options: CliAgentOptions = {}): AgentAdapter => ({
  available: () => hasCommand("codex"),
  env: ["CODEX_HOME", "OPENAI_API_KEY", "OPENAI_BASE_URL"],
  name: "codex",
  run: async (input) => {
    const args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      ...(options.model ? ["-m", options.model] : []),
      ...(options.args ?? []),
      input.prompt,
    ];
    const result = await exec("codex", args, {
      cwd: input.cwd,
      env: input.env,
      timeoutMs: input.timeoutMs,
    });
    return {
      durationMs: result.durationMs,
      exitCode: result.code,
      timedOut: result.timedOut,
      transcript: result.output,
    };
  },
  version: () => versionOf("codex"),
});

/**
 * Runs the prompt's embedded commands in order, without an LLM. It's a free,
 * deterministic baseline: if the literal steps don't work, no agent will.
 */
export const literal = (): AgentAdapter => ({
  available: () => Promise.resolve(true),
  name: "literal",
  run: async (input) => {
    const started = performance.now();
    let transcript = "";
    let exitCode: number | null = 0;
    let timedOut = false;
    for (const command of collectCommands(input.rendered)) {
      // Commands depend on the ones before them, so they run one at a time.
      // oxlint-disable-next-line no-await-in-loop
      const result = await exec(
        "bash",
        ["-eo", "pipefail", "-c", command.text],
        {
          cwd: input.cwd,
          env: input.env,
          timeoutMs: input.timeoutMs,
        }
      );
      transcript += `$ ${command.text}\n${result.output}\n`;
      timedOut ||= result.timedOut;
      if (result.code !== 0 && exitCode === 0) {
        exitCode = result.code;
      }
    }
    return {
      durationMs: performance.now() - started,
      exitCode,
      timedOut,
      transcript,
    };
  },
  version: () => Promise.resolve("1"),
});

/** An agent that runs a shell script you write, for tests and demos. */
export const scriptAgent = (
  name: string,
  script: (input: AgentInput) => string
): AgentAdapter => ({
  available: () => Promise.resolve(true),
  name,
  run: async (input) => {
    const result = await exec("bash", ["-eo", "pipefail"], {
      cwd: input.cwd,
      env: input.env,
      input: script(input),
      timeoutMs: input.timeoutMs,
    });
    return {
      durationMs: result.durationMs,
      exitCode: result.code,
      timedOut: result.timedOut,
      transcript: result.output,
    };
  },
  version: () => Promise.resolve("1"),
});

const BUILT_IN: Record<string, () => AgentAdapter> = {
  "claude-code": () => claudeCode(),
  codex: () => codex(),
  literal: () => literal(),
};

export const resolveAgent = (agent: AgentAdapter | string): AgentAdapter => {
  if (typeof agent !== "string") {
    return agent;
  }
  const create = BUILT_IN[agent];
  if (!create) {
    throw new Error(
      `Unknown agent "${agent}". Use ${Object.keys(BUILT_IN).join(", ")}, or pass an adapter.`
    );
  }
  return create();
};
