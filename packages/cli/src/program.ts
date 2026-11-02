import { Command } from "commander";

import { registerCheck } from "./commands/check";
import { registerEval } from "./commands/eval";
import { registerInit } from "./commands/init";
import { registerList } from "./commands/list";
import { registerReport } from "./commands/report";
import { registerSnapshot } from "./commands/snapshot";
import { registerStatus } from "./commands/status";
import { registerStudio } from "./commands/studio";
import { registerTest } from "./commands/test";
import { registerUsages } from "./commands/usages";
import { BIN_NAME, DOCS_URL, VERSION } from "./meta";
import { writeStderr, writeStdout } from "./output";

/**
 * The CLI's commands. Errors throw instead of exiting, so `runCli` can map
 * them to exit codes; with `json`, commander's own messages are left out.
 */
export const createProgram = (options: { json?: boolean } = {}): Command => {
  // Subcommands inherit these, so they come before `command()` calls.
  const program = new Command(BIN_NAME)
    .exitOverride()
    .configureOutput({
      outputError: (text, write) => {
        if (!options.json) {
          write(text);
        }
      },
      writeErr: writeStderr,
      writeOut: writeStdout,
    })
    .description(
      "Catalog, snapshot, test, and evaluate the snippets and agent prompts in your product."
    )
    .version(VERSION)
    .addHelpText(
      "after",
      `
Agents: start with \`${BIN_NAME} status --json\`. Every command except
report and studio takes --json, and its \`next\` field lists what to do.

Exit codes: 0 when everything is fine, 1 when a command found problems,
2 when it couldn't run.

Docs: ${DOCS_URL}`
    );

  registerInit(program);
  registerStatus(program);
  registerList(program);
  registerSnapshot(program);
  registerCheck(program);
  registerTest(program);
  registerEval(program);
  registerUsages(program);
  registerReport(program);
  registerStudio(program);

  return program;
};
