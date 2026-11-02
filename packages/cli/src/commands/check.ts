import type { Command } from "commander";

import { checkIssues, loadAnalysis } from "../analysis";
import { colorizeDiff, snapshotPatch } from "../diff";
import { formatNextActions, nextActions } from "../next-actions";
import {
  colors as pc,
  cwd,
  formatIssue,
  setExitCode,
  write,
  writeError,
  writeJson,
} from "../output";

interface CheckOptions {
  base?: string;
  config?: string;
  json?: boolean;
}

export const registerCheck = (program: Command) =>
  program
    .command("check")
    .description(
      "Validate definitions and fail if any snapshot is missing, stale, or orphaned."
    )
    .option("--base <ref>", "also warn about ids removed since this git ref")
    .option(
      "--json",
      "print the issues, snapshot diffs, and next steps as JSON"
    )
    .option("-c, --config <path>", "the config file")
    .action(async (options: CheckOptions) => {
      const analysis = await loadAnalysis(cwd(), options);
      const { project, snapshots, status } = analysis;
      const issues = await checkIssues(analysis, options);
      const errors = issues.filter((issue) => issue.level === "error").length;
      const next = nextActions(issues);
      if (errors > 0) {
        setExitCode(1);
      }

      if (options.json) {
        writeJson({
          definitions: snapshots.length,
          diffs: Object.fromEntries(
            status.changed.map((change) => [
              change.id,
              snapshotPatch(change, project.config, cwd()),
            ])
          ),
          issues,
          next,
          ok: errors === 0,
          schemaVersion: 1,
        });
        return;
      }

      for (const issue of issues) {
        writeError(formatIssue(issue));
        const change =
          issue.code === "snapshot-changed"
            ? status.changed.find((item) => item.id === issue.id)
            : undefined;
        if (change) {
          writeError(
            colorizeDiff(snapshotPatch(change, project.config, cwd()), pc)
          );
        }
      }
      if (errors > 0) {
        writeError(pc.red(`\n${errors} error${errors === 1 ? "" : "s"}.`));
        for (const line of formatNextActions(next)) {
          writeError(line);
        }
        return;
      }
      write(
        pc.green(`${snapshots.length} definitions, all snapshots up to date.`)
      );
    });
