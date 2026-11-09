import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { CopybookError } from "./errors";

const run = promisify(execFile);

const gitMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const stderr =
    "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  return `${stderr}\n${error.message}`;
};

const git = async (cwd: string, args: string[]) => {
  try {
    const { stdout } = await run("git", args, {
      cwd,
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    if (error instanceof CopybookError) {
      throw error;
    }
    const detail = gitMessage(error);
    if (/not a git repository/iu.test(detail)) {
      throw new CopybookError(
        "USAGE",
        "Not a git repository. Run this from inside a git working tree."
      );
    }
    if (/bad revision|unknown revision|invalid object name/iu.test(detail)) {
      throw new CopybookError(
        "INVALID_OPTION",
        detail
          .split("\n")
          .map((line) => line.replace(/^fatal:\s*/iu, "").trim())
          .find((line) => line !== "") ?? "Unknown git revision."
      );
    }
    throw error;
  }
};

/**
 * Reject option-like refs, then resolve `base` to a commit SHA so later git
 * args cannot treat it as an option.
 */
const resolveCommit = async (cwd: string, base: string): Promise<string> => {
  if (base.startsWith("-")) {
    throw new CopybookError(
      "INVALID_OPTION",
      `Invalid git ref "${base}": refs must not start with "-"`
    );
  }
  try {
    const stdout = await git(cwd, [
      "rev-parse",
      "--verify",
      "--quiet",
      "--end-of-options",
      `${base}^{commit}`,
    ]);
    return stdout.trim();
  } catch (error) {
    if (error instanceof CopybookError) {
      throw error;
    }
    throw new CopybookError(
      "INVALID_OPTION",
      `Invalid git ref "${base}": unknown revision`
    );
  }
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
  const commit = await resolveCommit(root, base);
  const relative = path.relative(root, await realPath(dir)) || ".";
  const [diff, untracked] = await Promise.all([
    git(root, ["diff", "--name-only", commit, "--", relative]),
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
  const commit = await resolveCommit(root, base);
  const relative = toPosix(path.relative(root, await realPath(file)));
  try {
    return await git(root, ["show", `${commit}:${relative}`]);
  } catch (error) {
    if (error instanceof CopybookError) {
      throw error;
    }
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
  const commit = await resolveCommit(root, base);
  const relative = toPosix(path.relative(root, await realPath(dir)));
  const stdout = await git(root, [
    "ls-tree",
    "-r",
    "-z",
    "--name-only",
    commit,
    "--",
    relative || ".",
  ]).catch((error) => {
    if (error instanceof CopybookError) {
      throw error;
    }
    return "";
  });
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
