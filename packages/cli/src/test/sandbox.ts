import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { exec } from "./exec";

const INSTALL_TIMEOUT_MS = 5 * 60_000;
const VERSION_AT = /^(?<name>@?[^@]+)(?:@(?<range>.+))?$/u;

/** `ai@5` → ["ai", "5"]; `@scope/pkg` → ["@scope/pkg", "latest"]. */
const parseDependency = (spec: string): [string, string] => {
  const match = VERSION_AT.exec(spec);
  return [match?.groups?.name ?? spec, match?.groups?.range ?? "latest"];
};

const installs = new Map<string, Promise<string>>();

/**
 * A directory with the given npm packages installed, cached by their list.
 * Lifecycle scripts are disabled.
 */
export const npmSandbox = (
  root: string,
  packages: readonly string[]
): Promise<string> => {
  const sorted = [...new Set(packages)].toSorted();
  const hash = createHash("sha256")
    .update(sorted.join("\n"))
    .digest("hex")
    .slice(0, 16);
  const cached = installs.get(hash);
  if (cached) {
    return cached;
  }

  const install = (async () => {
    const dir = path.join(
      root,
      "node_modules",
      ".cache",
      "copybook",
      "sandboxes",
      hash
    );
    const marker = path.join(dir, ".installed");
    if (existsSync(marker)) {
      return dir;
    }
    await mkdir(dir, { recursive: true });
    const dependencies = Object.fromEntries(sorted.map(parseDependency));
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ dependencies, private: true, type: "module" }, null, 2)
    );
    const result = await exec(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        "--no-package-lock",
        "--loglevel=error",
      ],
      { cwd: dir, timeoutMs: INSTALL_TIMEOUT_MS }
    );
    if (result.code !== 0) {
      throw new Error(
        `npm install ${sorted.join(" ")} failed:\n${result.output.trim()}`
      );
    }
    await writeFile(marker, sorted.join("\n"));
    return dir;
  })();

  installs.set(hash, install);
  return install;
};

/** A fresh directory for one test case inside a sandbox. */
export const caseDir = async (sandbox: string, name: string) => {
  const dir = path.join(sandbox, "cases", name.replaceAll(/[^\w.-]+/gu, "_"));
  await mkdir(dir, { recursive: true });
  return dir;
};
