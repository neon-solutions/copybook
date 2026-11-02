import type { Command } from "commander";

import { loadAnalysis, searchDefinitions } from "../analysis";
import { changedIds } from "../changes";
import { nextActions } from "../next-actions";
import {
  colors as pc,
  cwd,
  formatIssue,
  table,
  write,
  writeError,
  writeJson,
} from "../output";

interface ListOptions {
  base?: string;
  changed?: boolean;
  config?: string;
  grep?: string;
  json?: boolean;
}

export const registerList = (program: Command) =>
  program
    .command("list")
    .description("List every definition, with its kind and placements.")
    .option("--json", "print the manifest as JSON")
    .option(
      "--grep <text>",
      "only definitions whose id, title, placements, tags, or rendered output contain this text"
    )
    .option("--changed", "only definitions whose output changed since --base")
    .option("--base <ref>", "the git ref to compare against", "HEAD")
    .option("-c, --config <path>", "the config file")
    .action(async (options: ListOptions) => {
      const analysis = await loadAnalysis(cwd(), options);
      let definitions = options.grep
        ? searchDefinitions(analysis, options.grep)
        : analysis.entries;

      if (options.changed) {
        const ids = new Set(
          await changedIds(
            analysis.project,
            analysis.snapshots,
            options.base ?? "HEAD"
          )
        );
        definitions = definitions.filter((entry) => ids.has(entry.id));
      }

      if (options.json) {
        writeJson({
          definitions,
          issues: analysis.issues,
          next: nextActions(analysis.issues),
          ok: true,
          schemaVersion: 1,
          version: 1,
        });
        return;
      }

      for (const issue of analysis.issues) {
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
