import path from "node:path";

import { createTwoFilesPatch } from "diff";

import type { ResolvedConfig } from "./config";
import type { SnapshotStatus } from "./snapshot";

type Change = SnapshotStatus["changed"][number];

interface DiffColors {
  cyan: (text: string) => string;
  green: (text: string) => string;
  red: (text: string) => string;
}

/** A unified diff from the committed snapshot to the rendered one. */
export const snapshotPatch = (
  change: Change,
  config: ResolvedConfig,
  cwd: string
) => {
  const file = path.relative(
    cwd,
    path.join(config.snapshotsDir, `${change.id}.md`)
  );
  return createTwoFilesPatch(
    file,
    file,
    change.current,
    change.next,
    "committed",
    "rendered"
  );
};

export const colorizeDiff = (patch: string, colors: DiffColors) =>
  patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        return colors.green(line);
      }
      if (line.startsWith("-") && !line.startsWith("---")) {
        return colors.red(line);
      }
      return line.startsWith("@@") ? colors.cyan(line) : line;
    })
    .join("\n");
