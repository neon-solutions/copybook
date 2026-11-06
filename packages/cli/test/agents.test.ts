import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderAgentsBlock, upsertBlock } from "../src/agents/agents-md";
import { mcpServerEntry, mergeMcpConfig } from "../src/agents/mcp-config";
import { applyAgentSetup, planAgentSetup } from "../src/agents/setup";
import { renderSkill } from "../src/agents/skill";

const repoRoot = path.join(import.meta.dirname, "../../..");
const block = renderAgentsBlock({ runner: "npx copybook" });

const plan = (root: string) =>
  planAgentSetup(root, { manager: "npm", platform: "linux" });

describe(upsertBlock, () => {
  it("creates, appends, and replaces only the marked block", () => {
    const created = upsertBlock(undefined, block);
    const appended = upsertBlock("# Rules\n\nUse tabs.\n", block);
    const replaced = upsertBlock(
      appended.replace("status --json", "old"),
      block
    );

    expect(created).toBe(`${block}\n`);
    expect(appended).toBe(`# Rules\n\nUse tabs.\n\n${block}\n`);
    expect(replaced).toBe(appended);
  });
});

describe(renderAgentsBlock, () => {
  it("names the project's config file", () => {
    expect(block).toContain("configured in `copybook.config.ts`.");
    expect(block).toContain(
      "Markdown prompts from the config's `markdown` sources are their own snapshots"
    );
    expect(
      renderAgentsBlock({
        configFile: "copybook.config.mjs",
        runner: "npx copybook",
      })
    ).toContain("configured in `copybook.config.mjs`.");
  });
});

describe(mergeMcpConfig, () => {
  const entry = { args: ["--no", "copybook", "mcp"], command: "npx" };

  it("adds the server and keeps the others", () => {
    const merged = mergeMcpConfig(
      '{ "mcpServers": { "other": { "command": "x" } } }',
      "mcpServers",
      entry
    );

    expect(JSON.parse(merged ?? "")).toStrictEqual({
      mcpServers: { copybook: entry, other: { command: "x" } },
    });
  });

  it("leaves files that aren't plain JSON alone", () => {
    expect(
      mergeMcpConfig('// comment\n{ "servers": {} }', "servers", entry)
    ).toBeUndefined();
    expect(mergeMcpConfig("[]", "servers", entry)).toBeUndefined();
  });
});

describe(mcpServerEntry, () => {
  it("uses the project's runner, through cmd on Windows", () => {
    expect(
      mcpServerEntry({ manager: "pnpm", platform: "darwin" })
    ).toStrictEqual({ args: ["exec", "copybook", "mcp"], command: "pnpm" });
    expect(mcpServerEntry({ manager: "npm", platform: "win32" })).toStrictEqual(
      {
        args: ["/c", "npx", "--no", "copybook", "mcp"],
        command: "cmd",
      }
    );
  });
});

describe(planAgentSetup, () => {
  it("only touches each tool's files when that tool is set up", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "copybook-agents-"));
    await writeFile(path.join(root, "CLAUDE.md"), "@AGENTS.md\n");
    await mkdir(path.join(root, ".vscode"));
    await writeFile(
      path.join(root, ".vscode/mcp.json"),
      '// comments\n{ "servers": {} }'
    );

    const changes = await plan(root);
    const byPath = new Map(changes.map((change) => [change.path, change]));

    expect(byPath.get("AGENTS.md")?.action).toBe("create");
    expect(byPath.get("CLAUDE.md")?.action).toBe("skip");
    expect(byPath.get(".vscode/mcp.json")?.action).toBe("skip");
    expect(byPath.has(".cursor/mcp.json")).toBeFalsy();
    expect(byPath.get(".gitignore")?.content).toBe(".copybook/\n");
  });

  it("changes nothing on a second run", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "copybook-agents-"));
    await applyAgentSetup(root, await plan(root));
    const again = await plan(root);

    expect(new Set(again.map((change) => change.action))).toStrictEqual(
      new Set(["unchanged"])
    );
    await expect(
      readFile(path.join(root, ".claude/skills/copybook/SKILL.md"), "utf-8")
    ).resolves.toBe(renderSkill({ runner: "npx copybook" }));
  });
});

describe(renderSkill, () => {
  it("matches the published skill in skills/copybook", async () => {
    const published = await readFile(
      path.join(repoRoot, "skills/copybook/SKILL.md"),
      "utf-8"
    );

    expect(published).toBe(renderSkill({ runner: "npx copybook" }));
  });
});
