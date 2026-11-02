import type { Command } from "commander";

import { loadAnalysis } from "../analysis";
import { definitionDetail, definitionMarkdown } from "../detail";
import { CopybookError } from "../errors";
import { cwd, write, writeJson, writeStdout } from "../output";
import { readResults } from "../results";

interface ShowOptions {
  config?: string;
  json?: boolean;
  text?: boolean;
  values?: string;
  variant?: string;
}

const parseValues = (text: string) => {
  try {
    const values: unknown = JSON.parse(text);
    if (
      typeof values === "object" &&
      values !== null &&
      !Array.isArray(values)
    ) {
      return values as Record<string, unknown>;
    }
  } catch {
    // Reported below.
  }
  throw new CopybookError(
    "INVALID_VALUES",
    `--values must be a JSON object, such as '{"projectId":"proj-123"}'.`
  );
};

export const registerShow = (program: Command) =>
  program
    .command("show")
    .description(
      "Show one definition: where it's shown, its params, its rendered output, tests, and history."
    )
    .argument("<id>", "the definition's id, or an alias it kept")
    .option("--values <json>", "param values as JSON, over the examples")
    .option("--variant <key>", "only this snippet variant")
    .option("--text", "print only the rendered text, for piping")
    .option("--json", "print the details as JSON")
    .option("-c, --config <path>", "the config file")
    .action(async (id: string, options: ShowOptions) => {
      const analysis = await loadAnalysis(cwd(), options);
      const detail = await definitionDetail(analysis, id, {
        results: await readResults(analysis.project.config.root),
        ...(options.values ? { values: parseValues(options.values) } : {}),
        ...(options.variant ? { variant: options.variant } : {}),
      });

      if (options.json) {
        writeJson(detail);
        return;
      }
      if (options.text) {
        const [only, ...others] = detail.outputs;
        if (!only || others.length > 0) {
          throw new CopybookError(
            "INVALID_OPTION",
            `"${detail.definition.id}" has ${detail.outputs.length} variants. Pick one with --variant: ${detail.outputs.map((output) => output.variant).join(", ")}.`
          );
        }
        write(only.text);
        return;
      }
      writeStdout(definitionMarkdown(detail));
    });
