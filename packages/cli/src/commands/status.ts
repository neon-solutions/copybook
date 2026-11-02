import type { Command } from "commander";

import { loadAnalysis } from "../analysis";
import { formatNextActions } from "../next-actions";
import { colors as pc, cwd, table, write, writeJson } from "../output";
import { buildStatus } from "../status";

interface StatusOptions {
  config?: string;
  json?: boolean;
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const registerStatus = (program: Command) =>
  program
    .command("status")
    .description(
      "Show the project's definitions, snapshots, issues, and latest results, and what to do next."
    )
    .option("--json", "print the status as JSON")
    .option("-c, --config <path>", "the config file")
    .action(async (options: StatusOptions) => {
      const status = await buildStatus(await loadAnalysis(cwd(), options));
      if (options.json) {
        writeJson(status);
        return;
      }

      const { definitions, snapshots } = status;
      const stale = [
        snapshots.missing.length > 0
          ? `${snapshots.missing.length} missing`
          : "",
        snapshots.changed.length > 0
          ? `${snapshots.changed.length} changed`
          : "",
        snapshots.orphaned.length > 0
          ? `${snapshots.orphaned.length} orphaned`
          : "",
      ].filter(Boolean);
      const errors = status.issues.filter((issue) => issue.level === "error");
      const run = (summary: typeof status.tests) =>
        summary
          ? `${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`
          : pc.dim("not run yet");

      write(`${pc.bold(status.name)} ${pc.dim(`(${status.runner})`)}`);
      write(
        table([
          ["config", status.config.file],
          [
            "definitions",
            `${definitions.total}: ${plural(definitions.prompt, "prompt")}, ${plural(definitions.snippet, "snippet")}, ${plural(definitions.command, "command")}`,
          ],
          [
            "snapshots",
            stale.length > 0 ? pc.yellow(stale.join(", ")) : "all up to date",
          ],
          [
            "issues",
            status.issues.length === 0
              ? "none"
              : `${plural(errors.length, "error")}, ${plural(status.issues.length - errors.length, "warning")}`,
          ],
          ["tests", run(status.tests)],
          ["evals", run(status.evals)],
        ])
      );
      write(
        status.clean
          ? pc.green("\nNothing to do.")
          : `\n${formatNextActions(status.next).join("\n")}`
      );
    });
