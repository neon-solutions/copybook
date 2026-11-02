import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { findConfig } from "../config";
import { CopybookError } from "../errors";
import { BIN_NAME, DOCS_URL } from "../meta";
import type { NextAction } from "../next-actions";
import { colors as pc, cwd, write, writeJson } from "../output";
import { detectPackageManager } from "../package-manager";
import type { PackageManager } from "../package-manager";

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
  json?: boolean;
}

const NEXT_STEPS: NextAction[] = [
  {
    code: "define",
    safe: true,
    title:
      "Move a snippet or prompt into a *.prompts.ts file with defineSnippet, defineCommand, or definePrompt.",
  },
  {
    argv: ["snapshot"],
    code: "write-snapshots",
    command: `${BIN_NAME} snapshot`,
    safe: true,
    title: "Write the snapshots and commit them.",
    tool: "write_snapshots",
  },
  {
    argv: ["check"],
    code: "add-check-to-ci",
    command: `${BIN_NAME} check`,
    safe: false,
    title: "Add copybook check to CI.",
  },
];

export const registerInit = (program: Command) =>
  program
    .command("init")
    .description("Create copybook.config.ts and install the packages.")
    .option("--no-install", "skip installing @copybook/core and the CLI")
    .option("--json", "print what was created and installed as JSON")
    .action(async (options: InitOptions) => {
      const root = cwd();
      const existing = findConfig(root);
      if (existing && path.dirname(existing) === root) {
        throw new CopybookError(
          "CONFIG_EXISTS",
          `${path.basename(existing)} already exists.`
        );
      }
      const human = (text: string) => {
        if (!options.json) {
          write(text);
        }
      };

      await writeFile(path.join(root, "copybook.config.ts"), CONFIG_TEMPLATE);
      human(`${pc.green("created")}  copybook.config.ts`);

      const installed: string[] = [];
      if (options.install !== false) {
        const manager = detectPackageManager(root);
        for (const [pkg, dev] of [
          ["@copybook/core", false],
          [`@copybook/cli`, true],
        ] as const) {
          const args = [...addCommand(manager, dev), pkg];
          human(pc.dim(`$ ${manager} ${args.join(" ")}`));
          // With --json, stdout carries only the result.
          const result = spawnSync(manager, args, {
            cwd: root,
            stdio: options.json ? ["inherit", 2, 2] : "inherit",
          });
          if (result.status !== 0) {
            throw new CopybookError(
              "INSTALL_FAILED",
              `Installing ${pkg} failed. Install it yourself, then continue.`
            );
          }
          installed.push(pkg);
        }
      }

      if (options.json) {
        writeJson({
          created: ["copybook.config.ts"],
          installed,
          next: NEXT_STEPS,
          ok: true,
          schemaVersion: 1,
        });
        return;
      }
      write(`
Next steps:
  1. Move a snippet or prompt into a *.prompts.ts file with defineSnippet,
     defineCommand, or definePrompt.
  2. Run ${pc.bold(`${BIN_NAME} snapshot`)} and commit the snapshots.
  3. Add ${pc.bold(`${BIN_NAME} check`)} to CI.

Docs: ${DOCS_URL}`);
    });
