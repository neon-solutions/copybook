import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Command } from "commander";
import pc from "picocolors";

import { changedIds } from "../changes";
import { loadProject } from "../load";
import { write } from "../output";
import { TIERS } from "../test/define";
import type { Tier } from "../test/define";
import { loadTestSpecs } from "../test/load";
import { buildPlan } from "../test/plan";
import { formatResult, summarize, toJUnit } from "../test/reporters";
import { runTests } from "../test/runner";
import { buildSnapshots } from "../validate";

interface TestCommandOptions {
  base: string;
  changed?: boolean;
  concurrency?: string;
  config?: string;
  only?: string[];
  output?: string;
  reporter: "json" | "junit" | "pretty";
  tier: string;
}

const parseTiers = (value: string): Tier[] => {
  const tiers = value.split(",").map((tier) => tier.trim());
  const unknown = tiers.filter((tier) => !TIERS.includes(tier as Tier));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown tier "${unknown.join(", ")}". Use ${TIERS.join(", ")}.`
    );
  }
  return tiers as Tier[];
};

export const RESULTS_DIR = ".copybook/results";

export const registerTest = (program: Command) =>
  program
    .command("test")
    .description("Check that commands and snippets parse, typecheck, and run.")
    .option(
      "-t, --tier <tiers>",
      "comma-separated tiers: syntax, typecheck, run",
      "syntax,typecheck"
    )
    .option("--only <ids...>", "only these definition ids")
    .option("--changed", "only definitions whose output changed since --base")
    .option("--base <ref>", "the git ref to compare against", "HEAD")
    .option("--reporter <reporter>", "pretty, json, or junit", "pretty")
    .option(
      "-o, --output <file>",
      "also write the json or junit report to a file"
    )
    .option("--concurrency <n>", "how many cases run at once")
    .option("-c, --config <path>", "the config file")
    .action(async (options: TestCommandOptions) => {
      const tiers = parseTiers(options.tier);
      const project = await loadProject(process.cwd(), options);
      const specs = await loadTestSpecs(project.config);

      let { definitions } = project;
      if (options.changed) {
        const { snapshots } = buildSnapshots(project);
        const ids = new Set(await changedIds(project, snapshots, options.base));
        definitions = definitions.filter(({ definition }) =>
          ids.has(definition.id)
        );
      }
      if (options.only) {
        const only = new Set(options.only);
        definitions = definitions.filter(({ definition }) =>
          only.has(definition.id)
        );
      }

      const cases = buildPlan(definitions, specs, tiers);
      const pretty = options.reporter === "pretty";
      const report = await runTests(cases, {
        concurrency: Number(
          options.concurrency ??
            Math.max(1, Math.floor(os.availableParallelism() / 2))
        ),
        ...(pretty
          ? { onResult: (result) => write(formatResult(result)) }
          : {}),
        root: project.config.root,
        runId: randomBytes(4).toString("hex"),
      });

      const resultsDir = path.join(project.config.root, RESULTS_DIR);
      await mkdir(resultsDir, { recursive: true });
      await writeFile(
        path.join(resultsDir, "test.json"),
        JSON.stringify(report, null, 2)
      );

      const serialized =
        options.reporter === "junit"
          ? toJUnit(report)
          : JSON.stringify(report, null, 2);
      if (options.output) {
        await writeFile(
          path.resolve(options.output),
          options.reporter === "junit"
            ? serialized
            : JSON.stringify(report, null, 2)
        );
      }
      if (pretty) {
        write(
          `\n${cases.length === 0 ? pc.dim("Nothing to test.") : summarize(report)}`
        );
      } else if (!options.output) {
        write(serialized);
      }
      if (report.results.some((result) => result.status === "fail")) {
        process.exitCode = 1;
      }
    });
