import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";
import pc from "picocolors";

import { findConfig } from "../config";
import { BIN_NAME, DOCS_URL } from "../meta";
import { write, writeError } from "../output";

type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

export const detectPackageManager = (cwd: string): PackageManager => {
  for (const [lockfile, manager] of LOCKFILES) {
    if (existsSync(path.join(cwd, lockfile))) {
      return manager;
    }
  }
  return "npm";
};

const addCommand = (manager: PackageManager, dev: boolean): string[] => {
  const verb = manager === "npm" ? "install" : "add";
  return dev ? [verb, "-D"] : [verb];
};

export const CONFIG_TEMPLATE = `import { defineConfig } from "@copybook/cli";

export default defineConfig({
  // Files that export definitions. Keep them free of app-only imports,
  // or list those modules in \`stubs\`.
  content: ["**/*.prompts.ts"],
});
`;

interface InitOptions {
  install?: boolean;
}

export const registerInit = (program: Command) =>
  program
    .command("init")
    .description("Create copybook.config.ts and install the packages.")
    .option("--no-install", "skip installing @copybook/core and the CLI")
    .action(async (options: InitOptions) => {
      const cwd = process.cwd();
      const existing = findConfig(cwd);
      if (existing && path.dirname(existing) === cwd) {
        writeError(`${path.basename(existing)} already exists.`);
        process.exitCode = 1;
        return;
      }

      await writeFile(path.join(cwd, "copybook.config.ts"), CONFIG_TEMPLATE);
      write(`${pc.green("created")}  copybook.config.ts`);

      if (options.install !== false) {
        const manager = detectPackageManager(cwd);
        for (const [pkg, dev] of [
          ["@copybook/core", false],
          [`@copybook/cli`, true],
        ] as const) {
          const args = [...addCommand(manager, dev), pkg];
          write(pc.dim(`$ ${manager} ${args.join(" ")}`));
          const result = spawnSync(manager, args, { cwd, stdio: "inherit" });
          if (result.status !== 0) {
            writeError(
              `Installing ${pkg} failed. Install it yourself, then continue.`
            );
            process.exitCode = 1;
            return;
          }
        }
      }

      write(`
Next steps:
  1. Move a snippet or prompt into a *.prompts.ts file with defineSnippet,
     defineCommand, or definePrompt.
  2. Run ${pc.bold(`${BIN_NAME} snapshot`)} and commit the snapshots.
  3. Add ${pc.bold(`${BIN_NAME} check`)} to CI.

Docs: ${DOCS_URL}`);
    });
