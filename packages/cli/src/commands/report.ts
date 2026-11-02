import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Command } from "commander";

import { changedIds } from "../changes";
import { loadProject } from "../load";
import { buildManifest } from "../manifest";
import { write } from "../output";
import { buildReport } from "../report";
import { readResults } from "../results";
import { snapshotPath } from "../snapshot";
import { findUsages } from "../usages";
import { buildSnapshots } from "../validate";

interface ReportOptions {
  base: string;
  config?: string;
}

const run = promisify(execFile);

const snapshotDiff = async (root: string, base: string, file: string) => {
  const result = await run("git", ["diff", "--no-color", base, "--", file], {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
  }).catch(() => null);
  return result?.stdout ?? "";
};

const readTests = async (root: string) => {
  const { test } = await readResults(root);
  return test?.results ?? [];
};

export const registerReport = (program: Command) =>
  program
    .command("report")
    .description(
      "Print a Markdown summary of changed definitions, for pull request comments."
    )
    .option("--base <ref>", "the git ref to compare against", "origin/main")
    .option("-c, --config <path>", "the config file")
    .action(async (options: ReportOptions) => {
      const project = await loadProject(process.cwd(), options);
      const { root } = project.config;
      const { snapshots } = buildSnapshots(project);
      const ids = new Set(await changedIds(project, snapshots, options.base));
      const entries = buildManifest(
        project.definitions,
        snapshots
      ).definitions.filter((entry) => ids.has(entry.id));
      const embeds = new Map(
        snapshots.map((snapshot) => [snapshot.id, snapshot.embeds])
      );
      const [usage, tests, diffs] = await Promise.all([
        findUsages(project, embeds),
        readTests(root),
        Promise.all(
          entries.map(async (entry) => [
            entry.id,
            await snapshotDiff(
              root,
              options.base,
              snapshotPath(project.config, entry.id)
            ),
          ])
        ),
      ]);

      write(
        buildReport({
          base: options.base,
          diffs: Object.fromEntries(diffs),
          entries,
          tests,
          ...(usage ? { renderedIn: usage.usages } : {}),
        })
      );
    });
