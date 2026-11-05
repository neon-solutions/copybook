import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BIN_NAME } from "../meta";
import type { PackageManager } from "../package-manager";
import { renderAgentsBlock, upsertBlock } from "./agents-md";
import { mcpServerEntry, mergeMcpConfig } from "./mcp-config";
import { renderSkill } from "./skill";

export interface FileChange {
  action: "create" | "skip" | "unchanged" | "update";
  /** What to write, for create and update. */
  content?: string;
  /** Relative to the project root, with forward slashes. */
  path: string;
  /** Why a file is skipped. */
  reason?: string;
}

const RUNNERS: Record<PackageManager, string> = {
  bun: `bunx ${BIN_NAME}`,
  npm: `npx ${BIN_NAME}`,
  pnpm: `pnpm exec ${BIN_NAME}`,
  yarn: `yarn ${BIN_NAME}`,
};

const GITIGNORE_LINE = ".copybook/";

const read = (file: string): Promise<string | undefined> =>
  existsSync(file) ? readFile(file, "utf-8") : Promise.resolve(undefined);

const change = (
  file: string,
  current: string | undefined,
  next: string
): FileChange => {
  if (current === undefined) {
    return { action: "create", content: next, path: file };
  }
  return current === next
    ? { action: "unchanged", path: file }
    : { action: "update", content: next, path: file };
};

const SKILL_FILES = [
  ".agents/skills/copybook/SKILL.md",
  ".claude/skills/copybook/SKILL.md",
] as const;

const MCP_CONFIGS = [
  { file: ".mcp.json", key: "mcpServers", needs: undefined },
  { file: ".cursor/mcp.json", key: "mcpServers", needs: ".cursor" },
  { file: ".vscode/mcp.json", key: "servers", needs: ".vscode/mcp.json" },
] as const;

const FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ...SKILL_FILES,
  ...MCP_CONFIGS.map((config) => config.file),
];

const isIgnored = (gitignore: string | undefined) =>
  (gitignore ?? "")
    .split("\n")
    .some((line) =>
      [".copybook", ".copybook/", "/.copybook/"].includes(line.trim())
    );

/**
 * What \`init\` writes so coding agents know Copybook: an AGENTS.md section,
 * the skill, MCP configs, and a .gitignore entry for results. Files that
 * belong to one tool are only touched when that tool is already set up.
 */
export const planAgentSetup = async (
  root: string,
  options: {
    /** The config's file name, such as `copybook.config.mjs`. */
    configFile?: string;
    manager: PackageManager;
    platform: NodeJS.Platform;
  }
): Promise<FileChange[]> => {
  const at = (file: string) => path.join(root, file);
  const contents = new Map(
    await Promise.all(
      FILES.map(async (file) => [file, await read(at(file))] as const)
    )
  );
  const runner = RUNNERS[options.manager];
  const block = renderAgentsBlock({
    runner,
    ...(options.configFile ? { configFile: options.configFile } : {}),
  });
  const skill = renderSkill({ runner });
  const entry = mcpServerEntry(options);
  const agents = contents.get("AGENTS.md");
  const claude = contents.get("CLAUDE.md");
  const gitignore = contents.get(".gitignore");

  const changes: FileChange[] = [
    change("AGENTS.md", agents, upsertBlock(agents, block)),
  ];
  if (claude !== undefined) {
    changes.push(
      claude.includes("@AGENTS.md")
        ? {
            action: "skip",
            path: "CLAUDE.md",
            reason: "It already imports AGENTS.md.",
          }
        : change("CLAUDE.md", claude, upsertBlock(claude, block))
    );
  }
  for (const file of SKILL_FILES) {
    changes.push(change(file, contents.get(file), skill));
  }
  for (const { file, key, needs } of MCP_CONFIGS) {
    if (needs !== undefined && !existsSync(at(needs))) {
      continue;
    }
    const current = contents.get(file);
    const merged = mergeMcpConfig(
      current,
      key,
      key === "servers" ? { type: "stdio", ...entry } : { ...entry }
    );
    changes.push(
      merged === undefined
        ? {
            action: "skip",
            path: file,
            reason: `It isn't plain JSON. Add the copybook server yourself: ${JSON.stringify(entry)}.`,
          }
        : change(file, current, merged)
    );
  }
  changes.push(
    isIgnored(gitignore)
      ? { action: "unchanged", path: ".gitignore" }
      : change(
          ".gitignore",
          gitignore,
          `${gitignore ? `${gitignore.trimEnd()}\n` : ""}${GITIGNORE_LINE}\n`
        )
  );
  return changes;
};

/** Writes the created and updated files of a plan. */
export const applyAgentSetup = async (
  root: string,
  changes: readonly FileChange[]
) => {
  await Promise.all(
    changes.map(async ({ action, content, path: file }) => {
      if (
        (action === "create" || action === "update") &&
        content !== undefined
      ) {
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), content);
      }
    })
  );
};

/** The command that adds the server to Codex, which keeps MCP config in TOML. */
export const codexCommand = (options: {
  manager: PackageManager;
  platform: NodeJS.Platform;
}) => {
  const entry = mcpServerEntry(options);
  return `codex mcp add copybook -- ${[entry.command, ...entry.args].join(" ")}`;
};
