import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BIN_NAME } from "../src/meta";
import { createProgram } from "../src/program";
import { runCli } from "../src/run";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

/** Runs the CLI with captured output and no inherited environment. */
const run = async (args: string[], cwd = fixture) => {
  const output = { stderr: "", stdout: "" };
  const code = await runCli(args, {
    cwd,
    env: {},
    stderr: { write: (text: string) => (output.stderr += text) },
    stdout: { write: (text: string) => (output.stdout += text) },
  });
  return { code, ...output };
};

const emptyDir = () => mkdtemp(path.join(os.tmpdir(), "copybook-empty-"));

describe(createProgram, () => {
  it("uses the bin name", () => {
    expect(createProgram().name()).toBe(BIN_NAME);
  });
});

describe(runCli, () => {
  it("exits 0 for --version", async () => {
    const { code, stdout } = await run(["--version"]);

    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });

  it("exits 2 with a next step when there's no config", async () => {
    const { code, stderr } = await run(["list"], await emptyDir());

    expect(code).toBe(2);
    expect(stderr).toContain("No copybook.config.ts found.");
    expect(stderr).toContain("Next: `copybook init`");
  });

  it("prints a JSON envelope for errors with --json", async () => {
    const { code, stdout } = await run(["list", "--json"], await emptyDir());

    expect(code).toBe(2);
    expect(JSON.parse(stdout)).toMatchObject({
      error: { code: "CONFIG_NOT_FOUND" },
      next: [{ argv: ["init"], code: "init" }],
      ok: false,
      schemaVersion: 1,
    });
  });

  it("exits 2 on usage errors, as JSON with --json", async () => {
    const plain = await run(["test", "--reporter", "xml"]);
    const json = await run(["list", "--nope", "--json"]);

    expect(plain.code).toBe(2);
    expect(plain.stderr).toContain("Allowed choices are pretty, json, junit");
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)).toMatchObject({
      error: { code: "USAGE" },
      ok: false,
    });
  });

  it("exits 2 when eval runs outside CI", async () => {
    const { code, stderr } = await run(["eval"]);

    expect(code).toBe(2);
    expect(stderr).toContain("CI=true");
  });

  it("prints issues, codes, and next steps with check --json", async () => {
    const { code, stdout } = await run(["check", "--json"]);
    const result = JSON.parse(stdout);

    expect(code).toBe(1);
    expect(result).toMatchObject({ ok: false, schemaVersion: 1 });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "snapshot-missing", id: "fixture.hello" })
    );
    expect(result.next).toContainEqual(
      expect.objectContaining({
        argv: ["snapshot"],
        code: "write-snapshots",
        tool: "write_snapshots",
      })
    );
  });

  it("filters list --json by rendered text", async () => {
    const { code, stdout } = await run([
      "list",
      "--json",
      "--grep",
      "echo hello",
    ]);
    const result = JSON.parse(stdout);

    expect(code).toBe(0);
    expect(result).toMatchObject({ ok: true, schemaVersion: 1, version: 1 });
    expect(
      result.definitions.map((entry: { id: string }) => entry.id)
    ).toContain("fixture.hello");
    expect(result.definitions[0]).toHaveProperty("snapshot");
  });

  it("reports status, with what to do next, and exits 0", async () => {
    const { code, stdout } = await run(["status", "--json"]);
    const status = JSON.parse(stdout);

    expect(code).toBe(0);
    expect(status).toMatchObject({
      clean: false,
      config: { content: ["src/**/*.ts"], file: "copybook.config.ts" },
      ok: true,
      runner: "pnpm exec copybook",
      schemaVersion: 1,
    });
    expect(status.snapshots.missing).toContain("fixture.hello");
    expect(status.next[0]).toMatchObject({ code: "write-snapshots" });
  });

  it("exits 1 when check finds problems", async () => {
    const { code, stderr } = await run(["check"]);

    expect(code).toBe(1);
    expect(stderr).toContain("Has no snapshot.");
  });
});
