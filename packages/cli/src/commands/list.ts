import type { Command } from "commander";

import { changedIds } from "../changes";
import { loadProject } from "../load";
import { buildManifest } from "../manifest";
import {
  cwd,
  formatIssue,
  colors as pc,
  table,
  write,
  writeError,
} from "../output";
import { buildSnapshots } from "../validate";

interface ListOptions {
  base?: string;
  changed?: boolean;
  config?: string;
  json?: boolean;
}

export const registerList = (program: Command) =>
  program
    .command("list")
    .description("List every definition, with its kind and placements.")
    .option("--json", "print the manifest as JSON")
    .option("--changed", "only definitions whose output changed since --base")
    .option("--base <ref>", "the git ref to compare against", "HEAD")
    .option("-c, --config <path>", "the config file")
    .action(async (options: ListOptions) => {
      const project = await loadProject(cwd(), options);
      const { issues, snapshots } = buildSnapshots(project);
      let { definitions } = buildManifest(project.definitions, snapshots);

      if (options.changed) {
        const ids = new Set(
          await changedIds(project, snapshots, options.base ?? "HEAD")
        );
        definitions = definitions.filter((entry) => ids.has(entry.id));
      }

      if (options.json) {
        write(JSON.stringify({ definitions, version: 1 }, null, 2));
        return;
      }

      for (const issue of issues) {
        writeError(formatIssue(issue));
      }
      if (definitions.length === 0) {
        write(pc.dim("No definitions found."));
        return;
      }
      write(
        table([
          ["ID", "KIND", "VARIANTS", "PLACEMENTS"].map((heading) =>
            pc.dim(heading)
          ),
          ...definitions.map((entry) => [
            entry.id,
            entry.kind,
            String(entry.variants?.length ?? 1),
            entry.placements.join(", ") || pc.dim("none"),
          ]),
        ])
      );
      write(pc.dim(`\n${definitions.length} definitions`));
    });
