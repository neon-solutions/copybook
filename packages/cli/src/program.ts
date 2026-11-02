import { Command } from "commander";

import { registerCheck } from "./commands/check";
import { registerEval } from "./commands/eval";
import { registerInit } from "./commands/init";
import { registerList } from "./commands/list";
import { registerReport } from "./commands/report";
import { registerSnapshot } from "./commands/snapshot";
import { registerStudio } from "./commands/studio";
import { registerTest } from "./commands/test";
import { registerUsages } from "./commands/usages";
import { BIN_NAME, DOCS_URL, VERSION } from "./meta";

export const createProgram = (): Command => {
  const program = new Command(BIN_NAME)
    .description(
      "Catalog, snapshot, test, and evaluate the snippets and agent prompts in your product."
    )
    .version(VERSION)
    .addHelpText("after", `\nDocs: ${DOCS_URL}`);

  registerInit(program);
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
