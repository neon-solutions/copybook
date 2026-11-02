import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";
import pc from "picocolors";

import { loadProject } from "../load";
import { write } from "../output";
import { TIERS } from "../test/define";
import type { Tier } from "../test/define";
import { formatResult, summarize, toJUnit } from "../test/reporters";
import { runProjectTests } from "../test/run-project";

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
      const pretty = options.reporter === "pretty";
      const { cases, report } = await runProjectTests(project, {
        base: options.base,
        ...(options.changed ? { changed: true } : {}),
        ...(options.concurrency
          ? { concurrency: Number(options.concurrency) }
          : {}),
        ...(options.only ? { ids: options.only } : {}),
        ...(pretty
          ? { onResult: (result) => write(formatResult(result)) }
          : {}),
        tiers,
      });

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
          `\n${cases === 0 ? pc.dim("Nothing to test.") : summarize(report)}`
        );
      } else if (!options.output) {
        write(serialized);
      }
      if (report.results.some((result) => result.status === "fail")) {
        process.exitCode = 1;
      }
    });
