import path from "node:path";

import type { Command } from "commander";

import { loadProject } from "../load";
import {
  cwd,
  formatIssue,
  colors as pc,
  setExitCode,
  write,
  writeError,
} from "../output";
import { writeSnapshots } from "../snapshot";
import { buildSnapshots } from "../validate";

interface SnapshotOptions {
  config?: string;
  prune?: boolean;
}

export const registerSnapshot = (program: Command) =>
  program
    .command("snapshot")
    .description("Write a rendered snapshot of every definition.")
    .option("--prune", "delete snapshots of definitions that no longer exist")
    .option("-c, --config <path>", "the config file")
    .action(async (options: SnapshotOptions) => {
      const project = await loadProject(cwd(), options);
      const { issues, snapshots } = buildSnapshots(project);
      const status = await writeSnapshots(project.config, snapshots, options);
      const dir = path.relative(cwd(), project.config.snapshotsDir) || ".";

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
      if (issues.some((issue) => issue.level === "error")) {
        setExitCode(1);
      }
    });
