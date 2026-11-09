import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { keepStdoutForProtocol } from "../src/commands/mcp";
import { loadProject } from "../src/load";
import { createCopybookMcp } from "../src/mcp/server";
import { openWorkspace } from "../src/workspace";
import type { Workspace } from "../src/workspace";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

/** Connects a client to the server in memory, through a fetch transport. */
const connect = async (
  getWorkspace: () => Promise<Workspace>,
  mode?: "auto"
) => {
  const handler = createMcpHandler(() => createCopybookMcp(getWorkspace));
  const client = new Client(
    { name: "copybook-test", version: "1.0.0" },
    mode ? { versionNegotiation: { mode } } : {}
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    })
  );
  return {
    client,
    close: async () => {
      await client.close();
      await handler.close();
    },
  };
};

interface ToolResult {
  content: { text: string; type: string }[];
  isError?: boolean;
}

const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) => {
  const result = (await client.callTool({
    arguments: args,
    name,
  })) as ToolResult;
  const [first] = result.content;
  return { isError: result.isError ?? false, text: first?.text ?? "" };
};

describe(keepStdoutForProtocol, () => {
  it("redirects log methods that would break the stdio protocol", () => {
    const original = {
      debug: console.debug,
      dir: console.dir,
      dirxml: console.dirxml,
      info: console.info,
      log: console.log,
    };
    const writes: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      writes.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
      );
      return true;
    }) as typeof process.stderr.write;

    try {
      keepStdoutForProtocol();
      console.dir({ ok: true });
      console.dirxml({ ok: true });
      console.log("hello");

      expect(console.dir).not.toBe(original.dir);
      expect(console.dirxml).not.toBe(original.dirxml);
      expect(console.log).not.toBe(original.log);
      expect(writes.some((chunk) => chunk.includes("ok"))).toBeTruthy();
      expect(writes.some((chunk) => chunk.includes("hello"))).toBeTruthy();
    } finally {
      Object.assign(console, original);
      process.stderr.write = write;
    }
  });
});

describe(createCopybookMcp, () => {
  let snapshotsDir: string;
  let workspace: Workspace;

  beforeAll(async () => {
    snapshotsDir = await mkdtemp(path.join(os.tmpdir(), "copybook-mcp-"));
    workspace = await openWorkspace({
      cwd: fixture,
      load: async () => {
        const project = await loadProject(fixture);
        return { ...project, config: { ...project.config, snapshotsDir } };
      },
    });
  });

  afterAll(() => workspace.close());

  it("lists its tools with annotations and instructions", async () => {
    const { client, close } = await connect(() => Promise.resolve(workspace));
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const instructions = client.getInstructions();
    await close();

    expect([...byName.keys()].toSorted()).toStrictEqual([
      "check",
      "find_definitions",
      "get_definition",
      "prune_snapshots",
      "render",
      "run_tests",
      "status",
      "write_snapshots",
    ]);
    expect(byName.get("status")?.annotations?.readOnlyHint).toBeTruthy();
    expect(
      byName.get("prune_snapshots")?.annotations?.destructiveHint
    ).toBeTruthy();
    expect(instructions).toContain("Start with status");
  });

  it("reports status, finds, reads, and renders definitions", async () => {
    const { client, close } = await connect(
      () => Promise.resolve(workspace),
      "auto"
    );
    const status = await call(client, "status");
    const found = await call(client, "find_definitions", {
      query: "echo hello",
    });
    const detail = await call(client, "get_definition", {
      id: "fixture.hello",
    });
    const rendered = await call(client, "render", {
      id: "fixture.hello",
      values: { name: "mcp" },
    });
    await close();

    expect(JSON.parse(status.text).next[0]).toMatchObject({
      code: "write-snapshots",
      tool: "write_snapshots",
    });
    expect(JSON.parse(found.text).definitions).toContainEqual(
      expect.objectContaining({ id: "fixture.hello" })
    );
    expect(detail.text).toContain("# `fixture.hello` (command)");
    expect(JSON.parse(rendered.text)).toStrictEqual({
      outputs: [{ text: "echo hello mcp" }],
    });
  });

  it("writes snapshots, then check passes for them", async () => {
    const { client, close } = await connect(() => Promise.resolve(workspace));
    const written = await call(client, "write_snapshots");
    const check = await call(client, "check");
    await close();

    expect(JSON.parse(written.text).written.added).toContain("fixture.hello");
    expect(
      existsSync(path.join(snapshotsDir, "fixture.hello.md"))
    ).toBeTruthy();
    expect(
      JSON.parse(check.text).issues.filter(
        (issue: { code: string }) => issue.code === "snapshot-missing"
      )
    ).toStrictEqual([]);
  });

  it("returns errors as tool errors, with a next step", async () => {
    const { client, close } = await connect(() => Promise.resolve(workspace));
    const unknown = await call(client, "get_definition", {
      id: "fixture.helo",
    });
    const noConfig = await connect(() => openWorkspace({ cwd: os.tmpdir() }));
    const missing = await call(noConfig.client, "status");
    await close();
    await noConfig.close();

    expect(unknown.isError).toBeTruthy();
    expect(JSON.parse(unknown.text)).toMatchObject({
      error: { code: "UNKNOWN_ID" },
    });
    expect(missing.isError).toBeTruthy();
    expect(JSON.parse(missing.text)).toMatchObject({
      error: { code: "CONFIG_NOT_FOUND" },
      next: [{ code: "init" }],
    });
  });
});
