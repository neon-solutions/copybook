import pc from "picocolors";

import type { Issue } from "./validate";

export const write = (text = "") => {
  process.stdout.write(`${text}\n`);
};

export const writeError = (text: string) => {
  process.stderr.write(`${text}\n`);
};

export const formatIssue = (issue: Issue) => {
  const label =
    issue.level === "error" ? pc.red("error") : pc.yellow("warning");
  const id = issue.id ? `${pc.bold(issue.id)}: ` : "";
  return `${label} ${id}${issue.message}`;
};

/** Pads columns to their widest cell. */
export const table = (rows: readonly (readonly string[])[]) => {
  const widths: number[] = [];
  for (const row of rows) {
    for (const [index, cell] of row.entries()) {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    }
  }
  return rows
    .map((row) =>
      row
        .map((cell, index) =>
          index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)
        )
        .join("  ")
        .trimEnd()
    )
    .join("\n");
};
