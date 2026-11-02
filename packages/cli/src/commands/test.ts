import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Option } from "commander";
import type { Command } from "commander";

import { CopybookError } from "../errors";
import { loadProject } from "../load";
import { cwd, colors as pc, setExitCode, write } from "../output";
import { TIERS } from "../test/define";
import type { Tier } from "../test/define";
import { formatResult, summarize, toJUnit } from "../test/reporters";
import { runProjectTests } from "../test/run-project";

interface TestCommandOptions {
  base: string;
  changed?: boolean;
  concurrency?: string;
  config?: string;
  json?: boolean;
  only?: string[];
  output?: string;
  reporter: "json" | "junit" | "pretty";
  tier: string;
}

const parseTiers = (value: string): Tier[] => {
  const tiers = value.split(",").map((tier) => tier.trim());
  const unknown = tiers.filter((tier) => !TIERS.includes(tier as Tier));
  if (unknown.length > 0) {
    throw new CopybookError(
      "INVALID_OPTION",
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
    .addOption(
      new Option("--reporter <reporter>", "how to print results")
        .choices(["pretty", "json", "junit"])
        .default("pretty")
    )
    .option("--json", "print the report as JSON, like --reporter json")
    .option(
      "-o, --output <file>",
      "also write the json or junit report to a file"
    )
    .option("--concurrency <n>", "how many cases run at once")
    .option("-c, --config <path>", "the config file")
    .action(async (options: TestCommandOptions) => {
      const tiers = parseTiers(options.tier);
      const reporter = options.json ? "json" : options.reporter;
      const project = await loadProject(cwd(), options);
      const pretty = reporter === "pretty";
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
        reporter === "junit"
          ? toJUnit(report)
          : JSON.stringify(report, null, 2);
      if (options.output) {
        await writeFile(
          path.resolve(options.output),
          reporter === "junit" ? serialized : JSON.stringify(report, null, 2)
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
        setExitCode(1);
      }
    });
