import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { applyAgentSetup, codexCommand, planAgentSetup } from "../agents/setup";
import type { FileChange } from "../agents/setup";
import { findConfig } from "../config";
import { CopybookError } from "../errors";
import { BIN_NAME, DOCS_URL } from "../meta";
import type { NextAction } from "../next-actions";
import { colors as pc, cwd, write, writeJson } from "../output";
import { detectPackageManager } from "../package-manager";
import type { PackageManager } from "../package-manager";

const PACKAGES = [
  { dev: false, name: "@copybook/core" },
  { dev: true, name: "@copybook/cli" },
] as const;

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
  agent?: boolean;
  dryRun?: boolean;
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

/** The packages the project doesn't list in package.json yet. */
const missingPackages = async (root: string) => {
  const file = path.join(root, "package.json");
  if (!existsSync(file)) {
    return [...PACKAGES];
  }
  const manifest = JSON.parse(await readFile(file, "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const listed = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  return PACKAGES.filter((pkg) => !listed.has(pkg.name));
};

const LABELS = {
  create: "created",
  skip: "skipped",
  unchanged: "unchanged",
  update: "updated",
} as const;

const DRY_RUN_LABELS = {
  create: "would create",
  skip: "would skip",
  unchanged: "unchanged",
  update: "would update",
} as const;

const formatChange = (fileChange: FileChange, dryRun: boolean) => {
  const label = (dryRun ? DRY_RUN_LABELS : LABELS)[fileChange.action].padEnd(
    12
  );
  const writes =
    fileChange.action === "create" || fileChange.action === "update";
  const reason = fileChange.reason ? pc.dim(` (${fileChange.reason})`) : "";
  return `${writes ? pc.green(label) : pc.dim(label)} ${fileChange.path}${reason}`;
};

const agentNote = (codex: string) => `
Coding agents read AGENTS.md and the Copybook skill. Claude Code picks up
.mcp.json once you approve it. For Codex, run:
  ${codex}
`;

export const registerInit = (program: Command) =>
  program
    .command("init")
    .description(
      "Set up Copybook: write copybook.config.ts, install the packages, and set up coding agents. Safe to run again."
    )
    .option("--no-install", "skip installing @copybook/core and the CLI")
    .option(
      "--no-agent",
      "skip the AGENTS.md section, skill, and MCP config for coding agents"
    )
    .option("--dry-run", "show what would change without writing anything")
    .option("--json", "print what changed as JSON")
    .action(async (options: InitOptions) => {
      const root = cwd();
      const dryRun = options.dryRun === true;
      const manager = detectPackageManager(root);
      const { platform } = process;
      const human = (text: string) => {
        if (!options.json) {
          write(text);
        }
      };

      const existing = findConfig(root);
      const files: FileChange[] = [
        existing !== undefined && path.dirname(existing) === root
          ? { action: "unchanged", path: path.basename(existing) }
          : {
              action: "create",
              content: CONFIG_TEMPLATE,
              path: "copybook.config.ts",
            },
      ];
      if (options.agent !== false) {
        files.push(...(await planAgentSetup(root, { manager, platform })));
      }
      if (!dryRun) {
        await applyAgentSetup(root, files);
      }
      for (const fileChange of files) {
        human(formatChange(fileChange, dryRun));
      }

      const installed: string[] = [];
      const missing =
        options.install === false ? [] : await missingPackages(root);
      for (const pkg of missing) {
        const args = [...addCommand(manager, pkg.dev), pkg.name];
        human(pc.dim(`$ ${manager} ${args.join(" ")}`));
        if (!dryRun) {
          // With --json, stdout carries only the result.
          const result = spawnSync(manager, args, {
            cwd: root,
            stdio: options.json ? ["inherit", 2, 2] : "inherit",
          });
          if (result.status !== 0) {
            throw new CopybookError(
              "INSTALL_FAILED",
              `Installing ${pkg.name} failed. Install it yourself, then continue.`
            );
          }
          installed.push(pkg.name);
        }
      }

      const codex =
        options.agent === false
          ? undefined
          : codexCommand({ manager, platform });
      if (options.json) {
        writeJson({
          dryRun,
          files: files.map(({ action, path: file, reason }) => ({
            action,
            path: file,
            ...(reason ? { reason } : {}),
          })),
          installed,
          next: NEXT_STEPS,
          ok: true,
          schemaVersion: 1,
          ...(codex ? { codex } : {}),
        });
        return;
      }
      write(`
Next steps:
  1. Move a snippet or prompt into a *.prompts.ts file with defineSnippet,
     defineCommand, or definePrompt.
  2. Run ${pc.bold(`${BIN_NAME} snapshot`)} and commit the snapshots.
  3. Add ${pc.bold(`${BIN_NAME} check`)} to CI.
${codex ? agentNote(codex) : ""}
Docs: ${DOCS_URL}`);
    });
