import path from "node:path";

import type { Command } from "commander";

import { loadProject } from "../load";
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
import { writeSnapshots } from "../snapshot";
import { buildSnapshots } from "../validate";
import type { Issue } from "../validate";

interface SnapshotOptions {
  config?: string;
  json?: boolean;
  prune?: boolean;
}

export const registerSnapshot = (program: Command) =>
  program
    .command("snapshot")
    .description("Write a rendered snapshot of every definition.")
    .option("--prune", "delete snapshots of definitions that no longer exist")
    .option("--json", "print what was written as JSON")
    .option("-c, --config <path>", "the config file")
    .action(async (options: SnapshotOptions) => {
      const project = await loadProject(cwd(), options);
      const { issues, snapshots } = buildSnapshots(project);
      const status = await writeSnapshots(project.config, snapshots, options);
      const dir = path.relative(cwd(), project.config.snapshotsDir) || ".";
      const orphanIssues: Issue[] = options.prune
        ? []
        : status.orphaned.map((id) => ({
            code: "snapshot-orphaned",
            id,
            level: "warning",
            message: "Has a snapshot but no definition.",
          }));
      const next = nextActions([...issues, ...orphanIssues]);
      const failed = issues.some((issue) => issue.level === "error");
      if (failed) {
        setExitCode(1);
      }

      if (options.json) {
        writeJson({
          issues,
          next,
          ok: !failed,
          schemaVersion: 1,
          snapshotsDir: dir,
          written: {
            added: status.missing,
            orphaned: options.prune ? [] : status.orphaned,
            removed: options.prune ? status.orphaned : [],
            updated: status.changed.map((change) => change.id),
          },
        });
        return;
      }

      for (const issue of issues) {
        writeError(formatIssue(issue));
      }
      for (const id of status.missing) {
        write(`${pc.green("added")}    ${id}`);
      }
      for (const { id } of status.changed) {
        write(`${pc.yellow("updated")}  ${id}`);
      }
      for (const id of status.orphaned) {
        write(
          options.prune
            ? `${pc.red("removed")}  ${id}`
            : `${pc.dim("orphaned")} ${id} ${pc.dim("(run with --prune to delete)")}`
        );
      }
      const written = status.missing.length + status.changed.length;
      write(
        pc.dim(
          `\n${written} written to ${dir}, ${snapshots.length} up to date in total`
        )
      );
      if (failed) {
        for (const line of formatNextActions(next)) {
          writeError(line);
        }
      }
    });
