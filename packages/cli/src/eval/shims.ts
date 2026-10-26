import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** What a shimmed binary does after logging its call. */
export type Shim =
  /** Run the real binary. */
  | "passthrough"
  /** A POSIX shell script that runs instead of the binary. `"$@"` holds the args. */
  | { script: string }
  /** Print this and exit, without running anything. */
  | { exitCode?: number; stdout?: string };

export interface ShimCall {
  args: string[];
  bin: string;
  /** `bin arg1 arg2`, for matching. */
  line: string;
}

const LOG_FILE = "calls.log";

const findOnPath = (bin: string, exclude: string) =>
  (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((dir) => dir !== exclude)
    .map((dir) => path.join(dir, bin))
    .find((candidate) => existsSync(candidate));

const shellQuote = (value: string) =>
  `'${value.replaceAll("'", String.raw`'\''`)}'`;

const shimBody = (bin: string, shim: Shim, dir: string) => {
  if (shim === "passthrough") {
    const real = findOnPath(bin, dir);
    return real
      ? `exec ${shellQuote(real)} "$@"`
      : `echo "${bin}: command not found" >&2\nexit 127`;
  }
  if ("script" in shim) {
    return shim.script;
  }
  const stdout = shim.stdout
    ? `printf '%s\\n' ${shellQuote(shim.stdout)}\n`
    : "";
  return `${stdout}exit ${shim.exitCode ?? 0}`;
};

/**
 * Writes logging wrappers for the given binaries into `dir`. Put `dir` first
 * on PATH, and every call is recorded, whichever agent made it.
 */
export const installShims = async (
  dir: string,
  shims: Readonly<Record<string, Shim>>
) => {
  await mkdir(dir, { recursive: true });
  const log = path.join(dir, LOG_FILE);
  await writeFile(log, "");
  await Promise.all(
    Object.entries(shims).map(async ([bin, shim]) => {
      const file = path.join(dir, bin);
      const script = [
        "#!/bin/sh",
        // One line per call: the bin and its args, separated by tabs.
        `{ printf '%s' ${shellQuote(bin)}; for arg in "$@"; do printf '\\t%s' "$arg"; done; printf '\\n'; } >> ${shellQuote(log)}`,
        shimBody(bin, shim, dir),
        "",
      ].join("\n");
      await writeFile(file, script);
      await chmod(file, 0o755);
    })
  );
  return log;
};

export const readShimCalls = async (log: string): Promise<ShimCall[]> => {
  const content = await readFile(log, "utf-8").catch(() => "");
  return content
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [bin = "", ...args] = line.split("\t");
      return { args, bin, line: [bin, ...args].join(" ") };
    });
};
