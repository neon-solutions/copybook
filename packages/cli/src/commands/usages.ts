import type { Command } from "commander";
import pc from "picocolors";

import { loadProject } from "../load";
import { write, writeError } from "../output";
import { findUsages } from "../usages";
import { buildSnapshots } from "../validate";

interface UsagesOptions {
  config?: string;
  json?: boolean;
}

export const registerUsages = (program: Command) =>
  program
    .command("usages")
    .description("Show which product files import each definition.")
    .option("--json", "print the report as JSON")
    .option("-c, --config <path>", "the config file")
    .action(async (options: UsagesOptions) => {
      const project = await loadProject(process.cwd(), options);
      const { snapshots } = buildSnapshots(project);
      const embeds = new Map(
        snapshots.map((snapshot) => [snapshot.id, snapshot.embeds])
      );
      const report = await findUsages(project, embeds);
      if (!report) {
        writeError(
          'Set usage: { include: ["src/**/*.tsx"] } in the config to scan your product code.'
        );
        process.exitCode = 1;
        return;
      }
      if (options.json) {
        write(JSON.stringify(report, null, 2));
        return;
      }
      for (const [id, files] of Object.entries(report.usages)) {
        write(pc.bold(id));
        for (const file of files) {
          write(`  ${file}`);
        }
      }
      for (const id of report.unused) {
        write(
          `${pc.yellow(id)} ${pc.dim("isn't imported by any scanned file")}`
        );
      }
    });
