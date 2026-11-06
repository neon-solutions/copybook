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

/** The repository's top-level directory, as git reports it (a real path). */
const toplevel = async (cwd: string) => {
  const stdout = await git(cwd, ["rev-parse", "--show-toplevel"]);
  return stdout.trim();
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
  const root = await toplevel(cwd);
  const relative = path.relative(root, await realPath(dir)) || ".";
  const [diff, untracked] = await Promise.all([
    git(root, ["diff", "--name-only", base, "--", relative]),
    git(root, ["ls-files", "--others", "--exclude-standard", "--", relative]),
  ]);
  return [...diff.split("\n"), ...untracked.split("\n")]
    .filter((line) => line !== "")
    .map((line) => path.join(root, line));
};

const toPosix = (file: string) => file.split(path.sep).join("/");

/** A file's content at `base`, or undefined when it didn't exist there. */
export const showFile = async (
  cwd: string,
  base: string,
  file: string
): Promise<string | undefined> => {
  const root = await toplevel(cwd);
  const relative = toPosix(path.relative(root, await realPath(file)));
  try {
    return await git(root, ["show", `${base}:${relative}`]);
  } catch {
    return undefined;
  }
};

/** Files under `dir` at `base`, relative to `dir` with forward slashes. */
export const listFiles = async (
  cwd: string,
  base: string,
  dir: string
): Promise<string[]> => {
  const root = await toplevel(cwd);
  const relative = toPosix(path.relative(root, await realPath(dir)));
  const stdout = await git(root, [
    "ls-tree",
    "-r",
    "-z",
    "--name-only",
    base,
    "--",
    relative || ".",
  ]).catch(() => "");
  const prefix = relative === "" ? "" : `${relative}/`;
  return stdout
    .split("\0")
    .filter((line) => line.startsWith(prefix) && line !== prefix)
    .map((line) => line.slice(prefix.length));
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
