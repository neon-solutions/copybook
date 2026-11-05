import path from "node:path";

import { listVariants, renderExample, toText } from "@copybook/core";

import { checkIssues, findDefinition, suggestIds } from "./analysis";
import type { Analysis, DefinitionEntry } from "./analysis";
import { CopybookError } from "./errors";
import { fileHistory } from "./git";
import type { Commit } from "./git";
import { entrySource } from "./manifest";
import { nextActions } from "./next-actions";
import type { NextAction } from "./next-actions";
import type { Results } from "./results";
import { snapshotFile } from "./snapshot";

const HISTORY_LIMIT = 5;

export interface DefinitionOutput {
  label?: string;
  lang?: string;
  text: string;
  variant?: string;
}

/** Everything about one definition: what `show` and `get_definition` return. */
export interface DefinitionDetail {
  definition: DefinitionEntry;
  evals: {
    agent: string;
    passRate: number;
    status: string;
    threshold: number;
  }[];
  /** The latest commits that changed its snapshot. */
  history: Commit[];
  next: NextAction[];
  ok: true;
  /** Rendered with the example values, overridden by `values`. */
  outputs: DefinitionOutput[];
  /** The id that was asked for, when it was an alias. */
  requested?: string;
  schemaVersion: 1;
  snapshotFile: string;
  tests: { message?: string; status: string; tier: string; variant?: string }[];
}

interface ParamJson {
  default?: unknown;
  description?: string;
  example?: unknown;
  kind?: string;
  optional?: boolean;
  placeholder?: string;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Finds `id`, or throws UNKNOWN_ID with the closest ids. */
export const requireDefinition = (analysis: Analysis, id: string) => {
  const found = findDefinition(analysis, id);
  if (found) {
    return found;
  }
  const suggestions = suggestIds(analysis, id);
  throw new CopybookError(
    "UNKNOWN_ID",
    `No definition "${id}".${suggestions.length > 0 ? ` Did you mean ${suggestions.map((suggestion) => `"${suggestion}"`).join(", ")}?` : ""}`,
    {
      next: [
        {
          argv: ["list"],
          code: "find-definition",
          command: "copybook list",
          safe: true,
          title: "List the definitions, or search them with list --grep.",
          tool: "find_definitions",
        },
      ],
    }
  );
};

/** Renders a definition's outputs with its examples plus `values`. */
export const renderOutputs = (
  analysis: Analysis,
  id: string,
  options: { values?: Record<string, unknown>; variant?: string } = {}
): DefinitionOutput[] => {
  const { definition } = requireDefinition(analysis, id).loaded;
  const values = options.values ?? {};
  try {
    if (definition.kind !== "snippet" || definition.variants.length <= 1) {
      const rendered = renderExample(definition, { values });
      return [
        {
          text: toText(rendered),
          ...(rendered.lang ? { lang: rendered.lang } : {}),
        },
      ];
    }
    const variants = listVariants(definition).filter(
      (variant) => !options.variant || variant.key === options.variant
    );
    if (variants.length === 0) {
      throw new CopybookError(
        "INVALID_OPTION",
        `No variant "${options.variant}". Use ${listVariants(definition)
          .map((variant) => `"${variant.key}"`)
          .join(", ")}.`
      );
    }
    return variants.map((variant) => ({
      label: variant.label,
      text: toText(renderExample(definition, { values, variant: variant.key })),
      variant: variant.key,
      ...(variant.lang ? { lang: variant.lang } : {}),
    }));
  } catch (error) {
    if (error instanceof CopybookError) {
      throw error;
    }
    throw new CopybookError("INVALID_VALUES", errorMessage(error));
  }
};

export const definitionDetail = async (
  analysis: Analysis,
  id: string,
  options: {
    results?: Results;
    values?: Record<string, unknown>;
    variant?: string;
  } = {}
): Promise<DefinitionDetail> => {
  const found = requireDefinition(analysis, id);
  const { entry } = found;
  const { config } = analysis.project;
  const file = snapshotFile(config, analysis.snapshots, entry.id);
  const [issues, history] = await Promise.all([
    checkIssues(analysis),
    fileHistory(config.root, file, HISTORY_LIMIT),
  ]);
  const own = issues.filter((issue) => issue.id === entry.id);
  const tests = (options.results?.test?.results ?? []).filter(
    (result) => result.id === entry.id
  );
  const evals = (options.results?.eval?.results ?? []).filter(
    (result) => result.id === entry.id
  );

  return {
    definition: entry,
    evals: evals.map((result) => ({
      agent: result.agent,
      passRate: result.passRate,
      status: result.status,
      threshold: result.threshold,
    })),
    history,
    next: nextActions(own, {
      ...(options.results?.eval
        ? { eval: { ...options.results.eval, results: evals } }
        : {}),
      ...(options.results?.test
        ? { test: { ...options.results.test, results: tests } }
        : {}),
    }),
    ok: true,
    outputs: renderOutputs(analysis, entry.id, {
      ...(options.values ? { values: options.values } : {}),
      ...(options.variant ? { variant: options.variant } : {}),
    }),
    ...(found.via ? { requested: id } : {}),
    schemaVersion: 1,
    snapshotFile: path.relative(config.root, file).split(path.sep).join("/"),
    tests: tests.map((result) => ({
      status: result.status,
      tier: result.tier,
      ...(result.message ? { message: result.message } : {}),
      ...(result.variant ? { variant: result.variant } : {}),
    })),
  };
};

const list = (items: readonly string[], empty: string) =>
  items.length > 0 ? items.map((item) => `\`${item}\``).join(", ") : empty;

const longestFence = (text: string) => {
  const runs = text.match(/`{3,}/gu) ?? [];
  return "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
};

const cell = (value: unknown) =>
  value === undefined ? "" : `\`${String(value).replaceAll("|", "\\|")}\``;

/** A definition as Markdown, for agents and "Copy for agent". */
export const definitionMarkdown = (detail: DefinitionDetail) => {
  const { definition: entry } = detail;
  const params = Object.entries(entry.params) as [string, ParamJson][];
  const lines = [
    `# \`${entry.id}\` (${entry.kind})`,
    "",
    ...(entry.title ? [entry.title, ""] : []),
    ...(entry.description ? [entry.description, ""] : []),
    ...(detail.requested ? [`Renamed from \`${detail.requested}\`.`, ""] : []),
    `- Source: \`${entrySource(entry)}\``,
    `- Placements: ${list(entry.placements, "none declared")}`,
    `- Rendered in: ${list(entry.renderedIn, "no scanned file")}`,
    `- Embeds: ${list(entry.embeds, "nothing")}`,
    `- Used by: ${list(entry.usedBy, "nothing")}`,
    `- Snapshot: \`${detail.snapshotFile}\` (${entry.snapshot})`,
    ...(entry.aliases.length > 0
      ? [`- Aliases: ${list(entry.aliases, "")}`]
      : []),
    "",
    "## Params",
    "",
    ...(params.length === 0
      ? ["None."]
      : [
          "| Name | Kind | Example | Default | Description |",
          "| --- | --- | --- | --- | --- |",
          ...params.map(
            ([name, param]) =>
              `| \`${name}\`${param.optional ? " (optional)" : ""} | ${param.kind ?? ""} | ${cell(param.example ?? param.placeholder)} | ${cell(param.default)} | ${param.description ?? ""} |`
          ),
        ]),
    "",
    "## Output",
    "",
    ...detail.outputs.flatMap((output) => {
      const fence = longestFence(output.text);
      return [
        ...(output.label
          ? [`### ${output.label} (\`${output.variant}\`)`, ""]
          : []),
        `${fence}${output.lang ?? (entry.kind === "prompt" ? "text" : "")}`,
        output.text,
        fence,
        "",
      ];
    }),
    "## Tests and evals",
    "",
    ...(detail.tests.length + detail.evals.length === 0
      ? ["No results yet. Run `copybook test`, and `copybook eval` in CI."]
      : [
          ...detail.tests.map(
            (test) =>
              `- ${test.tier}${test.variant ? ` (${test.variant})` : ""}: ${test.status}${test.message ? `. ${test.message.split("\n")[0]}` : ""}`
          ),
          ...detail.evals.map(
            (evaluation) =>
              `- eval with ${evaluation.agent}: ${evaluation.status}, pass rate ${Math.round(evaluation.passRate * 100)}% (needs ${Math.round(evaluation.threshold * 100)}%)`
          ),
        ]),
    "",
    "## History",
    "",
    ...(detail.history.length === 0
      ? ["The snapshot isn't committed yet."]
      : detail.history.map(
          (commit) =>
            `- ${commit.date.slice(0, 10)} \`${commit.hash.slice(0, 7)}\` ${commit.subject} (${commit.author})`
        )),
    ...(detail.next.length > 0
      ? [
          "",
          "## Next",
          "",
          ...detail.next.map(
            (action) =>
              `- ${action.title}${action.command ? ` Run \`${action.command}\`.` : ""}`
          ),
        ]
      : []),
  ];
  return `${lines.join("\n")}\n`;
};
