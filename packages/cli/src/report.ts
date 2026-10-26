import type { ManifestEntry } from "./manifest";
import type { TestResult } from "./test/types";

export interface ReportInput {
  base: string;
  /** Snapshot diff per changed id, from git. */
  diffs: Record<string, string>;
  entries: readonly ManifestEntry[];
  /** Files that render each id, when usage scanning is configured. */
  renderedIn?: Record<string, string[]>;
  tests?: readonly TestResult[];
}

/** Hidden in the comment, so CI can find and update its own comment. */
export const REPORT_MARKER = "<!-- prompt-manager-report -->";

const escapeCell = (text: string) => text.replaceAll("|", String.raw`\|`);

const testSummary = (results: readonly TestResult[]) => {
  if (results.length === 0) {
    return "—";
  }
  const failed = results.filter((result) => result.status === "fail").length;
  const passed = results.filter((result) => result.status === "pass").length;
  return failed > 0
    ? `❌ ${failed} failed, ${passed} passed`
    : `✅ ${passed} passed`;
};

const fenceFor = (content: string) => {
  let ticks = "```";
  while (content.includes(ticks)) {
    ticks += "`";
  }
  return ticks;
};

/** A Markdown summary of the definitions a pull request changes. */
export const buildReport = ({
  base,
  diffs,
  entries,
  renderedIn = {},
  tests = [],
}: ReportInput) => {
  const lines = [REPORT_MARKER, "## Prompt Manager", ""];
  if (entries.length === 0) {
    lines.push(`No rendered snippets or prompts changed since \`${base}\`.`);
    return `${lines.join("\n")}\n`;
  }

  const count = entries.length;
  lines.push(
    `**${count} definition${count === 1 ? "" : "s"} changed** since \`${base}\`. Review the rendered output below.`,
    "",
    "| Definition | Kind | Placements | Rendered in | Tests |",
    "| --- | --- | --- | --- | --- |"
  );
  for (const entry of entries) {
    const files = renderedIn[entry.id] ?? [];
    lines.push(
      `| \`${entry.id}\` | ${entry.kind} | ${escapeCell(entry.placements.join(", ") || "—")} | ${escapeCell(files.join(", ") || "—")} | ${testSummary(tests.filter((result) => result.id === entry.id))} |`
    );
  }

  for (const entry of entries) {
    const diff = diffs[entry.id]?.trim();
    if (!diff) {
      continue;
    }
    const fence = fenceFor(diff);
    lines.push(
      "",
      `<details><summary><code>${entry.id}</code></summary>`,
      "",
      `${fence}diff`,
      diff,
      fence,
      "",
      "</details>"
    );
  }
  return `${lines.join("\n")}\n`;
};
