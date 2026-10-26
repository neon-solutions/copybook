import path from "node:path";

import type { Command } from "commander";
import { createTwoFilesPatch } from "diff";
import pc from "picocolors";

import { removedWithoutAlias } from "../changes";
import { loadProject } from "../load";
import { BIN_NAME } from "../meta";
import { formatIssue, write, writeError } from "../output";
import { compareSnapshots } from "../snapshot";
import { buildSnapshots } from "../validate";
import type { Issue } from "../validate";

interface CheckOptions {
  base?: string;
  config?: string;
}

const colorizeDiff = (patch: string) =>
  patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        return pc.green(line);
      }
      if (line.startsWith("-") && !line.startsWith("---")) {
        return pc.red(line);
      }
      return line.startsWith("@@") ? pc.cyan(line) : line;
    })
    .join("\n");

export const registerCheck = (program: Command) =>
  program
    .command("check")
    .description(
      "Validate definitions and fail if any snapshot is missing, stale, or orphaned."
    )
    .option("--base <ref>", "also warn about ids removed since this git ref")
    .option("-c, --config <path>", "the config file")
    .action(async (options: CheckOptions) => {
      const project = await loadProject(process.cwd(), options);
      const { issues, snapshots } = buildSnapshots(project);
      const status = await compareSnapshots(project.config, snapshots);
      const all: Issue[] = [...issues];

      for (const id of status.missing) {
        all.push({ id, level: "error", message: "Has no snapshot." });
      }
      for (const id of status.orphaned) {
        all.push({
          id,
          level: "error",
          message: "Has a snapshot but no definition.",
        });
      }
      for (const change of status.changed) {
        all.push({
          id: change.id,
          level: "error",
          message: "Snapshot is out of date:",
        });
      }
      if (options.base) {
        for (const id of await removedWithoutAlias(project, options.base)) {
          all.push({
            id,
            level: "warning",
            message: `Removed since ${options.base}. If it was renamed, add "${id}" to the new definition's aliases.`,
          });
        }
      }

      for (const issue of all) {
        writeError(formatIssue(issue));
        const change = status.changed.find((item) => item.id === issue.id);
        if (change && issue.message.startsWith("Snapshot")) {
          const file = path.relative(
            process.cwd(),
            path.join(project.config.snapshotsDir, `${change.id}.md`)
          );
          writeError(
            colorizeDiff(
              createTwoFilesPatch(
                file,
                file,
                change.current,
                change.next,
                "committed",
                "rendered"
              )
            )
          );
        }
      }

      const errors = all.filter((issue) => issue.level === "error").length;
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
        process.exitCode = 1;
        return;
      }
      write(
        pc.green(`${snapshots.length} definitions, all snapshots up to date.`)
      );
    });
