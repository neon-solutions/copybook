import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { defineCommand, p } from "@copybook/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadProject } from "../src/load";
import type { Project } from "../src/load";
import { startStudio } from "../src/studio/server";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

/** A raw request, so tests can send any Host header. */
const rawGet = async (url: string, headers: Record<string, string>) => {
  const request = httpRequest(url, { headers });
  request.end();
  const [response] = (await once(request, "response")) as [IncomingMessage];
  response.resume();
  return response.statusCode ?? 0;
};

const postJson = (url: string, route: string, body: unknown) =>
  fetch(`${url}${route}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

interface TestRun {
  results: { id: string; status: string }[];
  runId: string;
}

/** Polls /api/results until the run's report lands. */
const waitForRun = async (
  url: string,
  runId: string,
  attempts = 100
): Promise<TestRun | undefined> => {
  const response = await fetch(`${url}/api/results`);
  const { test } = (await response.json()) as { test?: TestRun };
  if (test?.runId === runId || attempts === 0) {
    return test;
  }
  await sleep(50);
  return waitForRun(url, runId, attempts - 1);
};

describe("studio server", () => {
  let studio: Awaited<ReturnType<typeof startStudio>>;

  beforeAll(async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "copybook-studio-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      "<!doctype html><p>studio</p>"
    );
    studio = await startStudio({
      cwd: fixture,
      host: "127.0.0.1",
      port: 0,
      staticDir,
      watch: false,
    });
  });

  afterAll(() => studio.close());

  const getJson = async <T>(route: string): Promise<T> => {
    const response = await fetch(`${studio.url}${route}`);
    return (await response.json()) as T;
  };

  const post = (route: string, body: unknown, type = "application/json") =>
    fetch(`${studio.url}${route}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": type },
      method: "POST",
    });

  it("serves the manifest with snapshot states and reverse embeds", async () => {
    const response = await fetch(`${studio.url}/api/manifest`);
    const manifest = (await response.json()) as {
      definitions: { id: string; snapshot: string; usedBy: string[] }[];
    };
    const hello = manifest.definitions.find(
      (entry) => entry.id === "fixture.hello"
    );

    expect(hello).toMatchObject({
      snapshot: "missing",
      usedBy: ["fixture.greet"],
    });
  });

  it("renders with live values", async () => {
    const response = await post("/api/render", {
      id: "fixture.hello",
      values: { name: "studio" },
    });
    const { text } = (await response.json()) as { text: string };

    expect(text).toBe("echo hello studio");
  });

  it("indexes its API, as JSON and for agents as Markdown", async () => {
    const index = await getJson<{ endpoints: { path: string }[] }>("/api");
    const llms = await fetch(`${studio.url}/llms.txt`);
    const negotiated = await fetch(`${studio.url}/`, {
      headers: { Accept: "text/markdown" },
    });

    expect(index.endpoints.map((endpoint) => endpoint.path)).toContain(
      "/api/status"
    );
    expect(llms.headers.get("content-type")).toContain("text/markdown");
    await expect(llms.text()).resolves.toContain("GET /api/status");
    await expect(negotiated.text()).resolves.toContain("# Copybook Studio");
  });

  it("serves status and definitions, as JSON and Markdown", async () => {
    const status = await getJson<{ next: { code: string }[] }>("/api/status");
    const json = await getJson<{ outputs: { text: string }[] }>(
      "/api/definitions/fixture.hello"
    );
    const markdown = await fetch(
      `${studio.url}/api/definitions/fixture.hello.md`
    );

    expect(status.next[0]?.code).toBe("write-snapshots");
    expect(json.outputs[0]?.text).toBe("echo hello world");
    await expect(markdown.text()).resolves.toContain(
      "# `fixture.hello` (command)"
    );
  });

  it("explains errors with codes and statuses", async () => {
    const unknown = await fetch(`${studio.url}/api/definitions/fixture.helo`);
    const method = await fetch(`${studio.url}/api/render`);
    const notJson = await post("/api/render", {}, "text/plain");
    const badJson = await fetch(`${studio.url}/api/render`, {
      body: "{",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toMatchObject({
      error: { code: "UNKNOWN_ID" },
    });
    expect(method.status).toBe(405);
    expect(notJson.status).toBe(415);
    expect(badJson.status).toBe(400);
  });

  it("refuses other hosts and cross-site POSTs", async () => {
    const rebound = await rawGet(`${studio.url}/api/manifest`, {
      Host: "evil.example:4983",
    });
    const viteProxy = await rawGet(`${studio.url}/api/manifest`, {
      Host: "localhost:5173",
    });
    const crossSite = await fetch(`${studio.url}/api/render`, {
      body: "{}",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      method: "POST",
    });

    expect(rebound).toBe(403);
    expect(viteProxy).toBe(200);
    expect(crossSite.status).toBe(403);
  });

  it("falls back to the UI for other paths", async () => {
    const response = await fetch(`${studio.url}/definitions/anything`);

    await expect(response.text()).resolves.toContain("studio");
  });

  it("rejects malformed percent-encoding with 400", async () => {
    const response = await fetch(`${studio.url}/api/definitions/%E0%A4%A`);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });
  });
});

const withExtraDefinitions = async (
  extras: ReturnType<typeof defineCommand>[]
): Promise<Project> => {
  const project = await loadProject(fixture);
  return {
    ...project,
    definitions: [
      ...project.definitions,
      ...extras.map((definition) => ({
        definition,
        exportName: definition.id,
        file: "extra.ts",
      })),
    ],
  };
};

describe("studio edge cases", () => {
  it("survives a definition that JSON.stringify cannot serialize", async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "copybook-bigint-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      "<!doctype html><p>studio</p>"
    );
    const schema = {
      "~standard": {
        types: { input: 0n as bigint, output: 0n as bigint },
        vendor: "test",
        version: 1 as const,
      },
    };
    const studio = await startStudio({
      cwd: fixture,
      host: "127.0.0.1",
      load: () =>
        withExtraDefinitions([
          defineCommand({
            id: "fixture.bigint",
            params: { n: p.schema(schema).example(10n) },
            template: (t, { n }) => t`echo ${String(n)}`,
          }),
        ]),
      port: 0,
      staticDir,
      watch: false,
    });
    try {
      const bad = await fetch(`${studio.url}/api/definitions/fixture.bigint`);
      const ok = await fetch(`${studio.url}/api/status`);

      expect(bad.status).toBe(500);
      await expect(bad.json()).resolves.toMatchObject({
        error: { code: "INTERNAL" },
      });
      expect(ok.status).toBe(200);
      await expect(ok.json()).resolves.toMatchObject({ schemaVersion: 1 });
    } finally {
      studio.close();
    }
  });

  it("serves JSON for an exact id that ends in .md", async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "copybook-md-id-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      "<!doctype html><p>studio</p>"
    );
    const studio = await startStudio({
      cwd: fixture,
      host: "127.0.0.1",
      load: () =>
        withExtraDefinitions([
          defineCommand({
            id: "fx.notes",
            template: () => "notes",
          }),
          defineCommand({
            id: "fx.notes.md",
            template: () => "notes.md body",
          }),
        ]),
      port: 0,
      staticDir,
      watch: false,
    });
    try {
      const response = await fetch(`${studio.url}/api/definitions/fx.notes.md`);
      const body = (await response.json()) as {
        definition: { id: string };
        outputs: { text: string }[];
      };

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );
      expect(body.definition.id).toBe("fx.notes.md");
      expect(body.outputs[0]?.text).toBe("notes.md body");
    } finally {
      studio.close();
    }
  });
});

describe("studio actions", () => {
  let studio: Awaited<ReturnType<typeof startStudio>>;
  let snapshotsDir: string;

  beforeAll(async () => {
    snapshotsDir = await mkdtemp(path.join(os.tmpdir(), "copybook-actions-"));
    studio = await startStudio({
      cwd: fixture,
      host: "127.0.0.1",
      load: async () => {
        const project = await loadProject(fixture);
        return { ...project, config: { ...project.config, snapshotsDir } };
      },
      port: 0,
      staticDir: snapshotsDir,
      watch: false,
    });
  });

  afterAll(() => studio.close());

  it("writes snapshots, then reports them up to date", async () => {
    const response = await postJson(studio.url, "/api/snapshot", {});
    const body = (await response.json()) as { written: { added: string[] } };
    const status = await fetch(`${studio.url}/api/status`);
    const { snapshots } = (await status.json()) as {
      snapshots: { missing: string[] };
    };

    expect(body.written.added).toContain("fixture.hello");
    expect(
      existsSync(path.join(snapshotsDir, "fixture.hello.md"))
    ).toBeTruthy();
    expect(snapshots.missing).toStrictEqual([]);
  });

  it("runs tests in the background, one run at a time", async () => {
    const responses = await Promise.all([
      postJson(studio.url, "/api/test", {
        ids: ["fixture.hello"],
        tiers: ["syntax"],
      }),
      postJson(studio.url, "/api/test", { tiers: ["syntax"] }),
    ]);
    const statuses = responses.map((response) => response.status).toSorted();
    const bodies = (await Promise.all(
      responses.map((response) => response.json())
    )) as { runId?: string }[];
    const runId = bodies.map((body) => body.runId).find(Boolean) ?? "";
    const test = await waitForRun(studio.url, runId);

    expect(statuses).toStrictEqual([202, 409]);
    expect(test?.results).toContainEqual(
      expect.objectContaining({ id: "fixture.hello", status: "pass" })
    );
  });

  it("leaves the run tier to the CLI", async () => {
    const response = await postJson(studio.url, "/api/test", {
      tiers: ["run"],
    });

    expect(response.status).toBe(400);
  });

  it("is read-only when it listens beyond localhost", async () => {
    const exposed = await startStudio({
      cwd: fixture,
      host: "0.0.0.0",
      port: 0,
      staticDir: snapshotsDir,
      watch: false,
    });
    const { port } = new URL(exposed.url);
    const response = await postJson(
      `http://127.0.0.1:${port}`,
      "/api/snapshot",
      {}
    );
    exposed.close();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "READ_ONLY" },
    });
  });
});
