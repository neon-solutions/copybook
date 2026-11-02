import pc from "picocolors";

import type { Issue } from "./validate";

type Colors = ReturnType<typeof pc.createColors>;

export interface CliStream {
  isTTY?: boolean;
  write: (text: string) => unknown;
}

/** Where a CLI run reads and writes. `runCli` sets it once per run. */
export interface CliContext {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  stderr: CliStream;
  stdout: CliStream;
}

export const defaultContext = (): CliContext => ({
  cwd: process.cwd(),
  env: process.env,
  stderr: process.stderr,
  stdout: process.stdout,
});

let context = defaultContext();
let exitCode = 0;

/**
 * Colors follow the output: off in `--json` mode, with `NO_COLOR`, or when
 * stdout isn't a terminal, even in CI. `FORCE_COLOR` turns them on.
 */
export const shouldColor = (ctx: CliContext, json: boolean) => {
  if (json || ctx.env.NO_COLOR) {
    return false;
  }
  if (ctx.env.FORCE_COLOR) {
    return true;
  }
  return ctx.stdout.isTTY === true && ctx.env.TERM !== "dumb";
};

/** The current run's colors. Commands import this instead of picocolors. */
export const colors: Colors = {
  ...pc.createColors(shouldColor(context, false)),
};

export const configureCli = (ctx: CliContext, options: { json: boolean }) => {
  context = ctx;
  exitCode = 0;
  Object.assign(colors, pc.createColors(shouldColor(ctx, options.json)));
};

export const cwd = () => context.cwd;
export const env = () => context.env;

/** Raises the run's exit code: 1 when a command finds problems. */
export const setExitCode = (code: 0 | 1 | 2) => {
  exitCode = Math.max(exitCode, code);
};

export const currentExitCode = () => exitCode;

export const writeStdout = (text: string) => {
  context.stdout.write(text);
};

export const writeStderr = (text: string) => {
  context.stderr.write(text);
};

export const write = (text = "") => {
  writeStdout(`${text}\n`);
};

export const writeError = (text: string) => {
  writeStderr(`${text}\n`);
};

export const writeJson = (payload: unknown) => {
  write(JSON.stringify(payload, null, 2));
};

export const formatIssue = (issue: Issue) => {
  const label =
    issue.level === "error" ? colors.red("error") : colors.yellow("warning");
  const id = issue.id ? `${colors.bold(issue.id)}: ` : "";
  return `${label} ${id}${issue.message}`;
};

/** Pads columns to their widest cell. */
export const table = (rows: readonly (readonly string[])[]) => {
  const widths: number[] = [];
  for (const row of rows) {
    for (const [index, cell] of row.entries()) {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    }
  }
  return rows
    .map((row) =>
      row
        .map((cell, index) =>
          index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)
        )
        .join("  ")
        .trimEnd()
    )
    .join("\n");
};
