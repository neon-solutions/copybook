import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
});
