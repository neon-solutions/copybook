import type { Command } from "commander";

import { buildCatalog } from "../catalog";
import { colors as pc, table, write, writeJson } from "../output";

export const registerCommands = (program: Command) =>
  program
    .command("commands")
    .description(
      "List every command, with its flags and whether agents can run it without asking."
    )
    .option("--json", "print the catalog as JSON")
    .action((options: { json?: boolean }, command: Command) => {
      const catalog = buildCatalog(command.parent ?? program);
      if (options.json) {
        writeJson(catalog);
        return;
      }
      write(
        table([
          ["COMMAND", "AGENTS", "WHAT IT DOES"].map((heading) =>
            pc.dim(heading)
          ),
          ...catalog.commands.map((entry) => [
            entry.name,
            entry.agent,
            entry.summary,
          ]),
        ])
      );
    });
