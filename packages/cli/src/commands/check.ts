import type { Command } from "commander";

import { checkIssues, loadAnalysis } from "../analysis";
import { colorizeDiff, snapshotPatch } from "../diff";
import { BIN_NAME } from "../meta";
import {
  cwd,
  formatIssue,
  colors as pc,
  setExitCode,
  write,
  writeError,
} from "../output";

interface CheckOptions {
  base?: string;
  config?: string;
}

export const registerCheck = (program: Command) =>
  program
    .command("check")
    .description(
      "Validate definitions and fail if any snapshot is missing, stale, or orphaned."
    )
    .option("--base <ref>", "also warn about ids removed since this git ref")
    .option("-c, --config <path>", "the config file")
    .action(async (options: CheckOptions) => {
      const analysis = await loadAnalysis(cwd(), options);
      const { project, snapshots, status } = analysis;
      const issues = await checkIssues(analysis, options);

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

      const errors = issues.filter((issue) => issue.level === "error").length;
      if (errors > 0) {
        const hasSnapshotErrors =
          status.missing.length +
            status.orphaned.length +
            status.changed.length >
          0;
        writeError(
          pc.red(`\n${errors} error${errors === 1 ? "" : "s"}.`) +
            (hasSnapshotErrors
              ? ` Run \`${BIN_NAME} snapshot${status.orphaned.length > 0 ? " --prune" : ""}\` to update snapshots.`
              : "")
        );
        setExitCode(1);
        return;
      }
      write(
        pc.green(`${snapshots.length} definitions, all snapshots up to date.`)
      );
    });
