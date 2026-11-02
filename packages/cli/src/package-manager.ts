import { existsSync } from "node:fs";
import path from "node:path";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

/**
 * The project's package manager, from the nearest lockfile in `root` or a
 * parent, so workspace packages find the workspace's. npm without one.
 */
export const detectPackageManager = (root: string): PackageManager => {
  let directory = path.resolve(root);
  for (;;) {
    for (const [lockfile, manager] of LOCKFILES) {
      if (existsSync(path.join(directory, lockfile))) {
        return manager;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return "npm";
    }
    directory = parent;
  }
};
