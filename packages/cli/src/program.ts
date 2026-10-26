import { Command } from "commander";

import { registerCheck } from "./commands/check";
import { registerInit } from "./commands/init";
import { registerList } from "./commands/list";
import { registerSnapshot } from "./commands/snapshot";
import { registerStudio } from "./commands/studio";
import { BIN_NAME, VERSION } from "./meta";

export const createProgram = (): Command => {
  const program = new Command(BIN_NAME)
    .description(
      "Catalog, snapshot, test, and evaluate the snippets and agent prompts in your product."
    )
    .version(VERSION);

  registerInit(program);
  registerList(program);
  registerSnapshot(program);
  registerCheck(program);
  registerStudio(program);

  return program;
};
