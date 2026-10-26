import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startStudio } from "../src/studio/server";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

describe("studio server", () => {
  let studio: Awaited<ReturnType<typeof startStudio>>;

  beforeAll(async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "pm-studio-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      "<!doctype html><p>studio</p>"
    );
    studio = await startStudio({
      cwd: fixture,
      host: "127.0.0.1",
      port: 0,
      staticDir,
    });
  });

  afterAll(() => studio.close());

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
    const response = await fetch(`${studio.url}/api/render`, {
      body: JSON.stringify({ id: "fixture.hello", values: { name: "studio" } }),
      method: "POST",
    });
    const { text } = (await response.json()) as { text: string };

    expect(text).toBe("echo hello studio");
  });

  it("falls back to the UI for other paths", async () => {
    const response = await fetch(`${studio.url}/definitions/anything`);

    await expect(response.text()).resolves.toContain("studio");
  });
});
