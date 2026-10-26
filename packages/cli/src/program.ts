import { Command } from "commander";

import { BIN_NAME, VERSION } from "./meta";

export const createProgram = (): Command =>
  new Command(BIN_NAME)
    .description(
      "Catalog, snapshot, test, and evaluate the snippets and agent prompts in your product."
    )
    .version(VERSION);
