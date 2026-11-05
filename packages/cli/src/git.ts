import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const git = async (cwd: string, args: string[]) => {
  const { stdout } = await run("git", args, {
    cwd,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
};

/**
 * The real path of `target`, resolving symlinks in its existing ancestors,
 * because git reports real paths. `target` itself may not exist yet.
 */
const realPath = async (target: string): Promise<string> => {
  try {
    return await realpath(target);
  } catch {
    const parent = path.dirname(target);
    return parent === target
      ? target
      : path.join(await realPath(parent), path.basename(target));
  }
};

/**
 * Files under `dir` that differ from `base`, including uncommitted and
 * untracked ones. Paths are absolute.
 */
export const changedFiles = async (
  cwd: string,
  dir: string,
  base: string
): Promise<string[]> => {
  const toplevel = await git(cwd, ["rev-parse", "--show-toplevel"]);
  const root = toplevel.trim();
  const relative = path.relative(root, await realPath(dir)) || ".";
  const [diff, untracked] = await Promise.all([
    git(root, ["diff", "--name-only", base, "--", relative]),
    git(root, ["ls-files", "--others", "--exclude-standard", "--", relative]),
  ]);
  return [...diff.split("\n"), ...untracked.split("\n")]
    .filter((line) => line !== "")
    .map((line) => path.join(root, line));
};

export interface Commit {
  author: string;
  date: string;
  hash: string;
  subject: string;
}

const FIELD_SEPARATOR = "\u001F";

/** The commits that touched a file, newest first. */
export const fileHistory = async (
  cwd: string,
  file: string,
  limit = 20
): Promise<Commit[]> => {
  const format = ["%H", "%an", "%aI", "%s"].join(FIELD_SEPARATOR);
  const stdout = await git(cwd, [
    "log",
    `-${limit}`,
    "--follow",
    `--format=${format}`,
    "--",
    file,
  ]).catch(() => "");
  return stdout
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [hash = "", author = "", date = "", subject = ""] =
        line.split(FIELD_SEPARATOR);
      return { author, date, hash, subject };
    });
};
