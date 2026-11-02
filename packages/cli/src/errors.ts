import type { NextAction } from "./next-actions";

export type ErrorCode =
  | "CONFIG_EXISTS"
  | "CONFIG_INVALID"
  | "CONFIG_NOT_FOUND"
  | "DUPLICATE_ID"
  | "EVAL_OUTSIDE_CI"
  | "INSTALL_FAILED"
  | "INTERNAL"
  | "INVALID_OPTION"
  | "INVALID_VALUES"
  | "LOAD_FAILED"
  | "UNKNOWN_ID"
  | "USAGE"
  | "USAGE_NOT_CONFIGURED";

/** A failure the CLI explains: a code for tools, and what to do next. */
export class CopybookError extends Error {
  readonly code: ErrorCode;
  /** 2 when the command couldn't run, 1 when it ran and found problems. */
  readonly exitCode: 1 | 2;
  readonly next: NextAction[];

  constructor(
    code: ErrorCode,
    message: string,
    options: { exitCode?: 1 | 2; next?: NextAction[] } = {}
  ) {
    super(message);
    this.name = "CopybookError";
    this.code = code;
    this.exitCode = options.exitCode ?? 2;
    this.next = options.next ?? [];
  }
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** What `--json` prints when a command fails. */
export const errorEnvelope = (error: unknown) => {
  const known = error instanceof CopybookError ? error : undefined;
  return {
    error: { code: known?.code ?? "INTERNAL", message: messageOf(error) },
    next: known?.next ?? [],
    ok: false,
    schemaVersion: 1,
  };
};
