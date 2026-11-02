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

/** The project's package manager, from its lockfile. npm without one. */
export const detectPackageManager = (root: string): PackageManager => {
  for (const [lockfile, manager] of LOCKFILES) {
    if (existsSync(path.join(root, lockfile))) {
      return manager;
    }
  }
  return "npm";
};
