import { CommanderError } from "commander";

import { CopybookError, errorEnvelope } from "./errors";
import { formatNextActions } from "./next-actions";
import {
  configureCli,
  currentExitCode,
  defaultContext,
  writeError,
  writeJson,
} from "./output";
import type { CliContext } from "./output";
import { createProgram } from "./program";

const report = (error: unknown, json: boolean) => {
  if (json) {
    writeJson(errorEnvelope(error));
    return;
  }
  writeError(error instanceof Error ? error.message : String(error));
  if (error instanceof CopybookError) {
    for (const line of formatNextActions(error.next)) {
      writeError(line);
    }
  }
};

/**
 * Runs the CLI with `args` (without `node` and the script) and returns the
 * exit code: 0 when everything is fine, 1 when a command found problems,
 * and 2 when it couldn't run.
 */
export const runCli = async (
  args: readonly string[],
  context: Partial<CliContext> = {}
): Promise<number> => {
  const json = args.includes("--json");
  configureCli({ ...defaultContext(), ...context }, { json });
  const program = createProgram({ json });
  try {
    await program.parseAsync([...args], { from: "user" });
    return currentExitCode();
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) {
        return 0;
      }
      // Commander already printed the message, unless this is --json.
      if (json) {
        report(new CopybookError("USAGE", error.message), true);
      }
      return 2;
    }
    report(error, json);
    return error instanceof CopybookError ? error.exitCode : 2;
  }
};
