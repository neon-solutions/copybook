import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadProject } from "../src/load";
import { findUsages } from "../src/usages";
import { buildSnapshots } from "../src/validate";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

describe(findUsages, () => {
  it("follows path aliases, ignores type imports, and counts embeds as used", async () => {
    const project = await loadProject(fixture);
    const { snapshots } = buildSnapshots(project);
    const embeds = new Map(
      snapshots.map((snapshot) => [snapshot.id, snapshot.embeds])
    );
    const report = await findUsages(project, embeds);

    expect(report).toStrictEqual({
      unused: ["fixture.lang.python", "fixture.lang.ruby", "fixture.readme"],
      usages: { "fixture.greet": ["app/page.tsx"] },
    });
  });
});

describe("usages of Markdown prompts", () => {
  it("finds prompts by URL in Markdown, MDX, and code", async () => {
    const project = await loadProject(
      path.join(import.meta.dirname, "fixtures/markdown")
    );
    const report = await findUsages(project);

    expect(report).toStrictEqual({
      unused: ["fixture.notes.release"],
      usages: {
        "fixture.prompts.guides.connect": ["app/docs/connect.mdx"],
        "fixture.prompts.setup": ["app/setup-button.tsx"],
      },
    });
  });
});
