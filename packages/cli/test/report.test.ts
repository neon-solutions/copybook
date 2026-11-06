import { describe, expect, it } from "vitest";

import type { ManifestEntry } from "../src/manifest";
import { buildReport, REPORT_MARKER } from "../src/report";

const entry: ManifestEntry = {
  aliases: [],
  embeds: [],
  hash: "abc",
  id: "console.create-project.agent",
  kind: "prompt",
  owners: [],
  params: {},
  placements: ["console/create-project"],
  source: { export: "setUp", file: "src/create-project.ts" },
  tags: [],
};

describe(buildReport, () => {
  it("summarizes changed definitions with tests and diffs", () => {
    const report = buildReport({
      base: "origin/main",
      diffs: { [entry.id]: "-acme deploy\n+acme deploy --yes" },
      entries: [entry],
      renderedIn: { [entry.id]: ["app/new/page.tsx"] },
      tests: [
        {
          durationMs: 1,
          id: entry.id,
          label: "cmd 1",
          status: "pass",
          tier: "syntax",
        },
      ],
    });

    expect(report.startsWith(REPORT_MARKER)).toBeTruthy();
    expect(report).toContain(
      "| `console.create-project.agent` | prompt | console/create-project | app/new/page.tsx | ✅ 1 passed |"
    );
    expect(report).toContain("```diff\n-acme deploy\n+acme deploy --yes\n```");
  });

  it("says when nothing changed", () => {
    expect(
      buildReport({ base: "origin/main", diffs: {}, entries: [] })
    ).toContain("No rendered snippets or prompts changed since `origin/main`.");
  });

  it("lists removed definitions with their file and URL", () => {
    const report = buildReport({
      base: "origin/main",
      diffs: {},
      entries: [],
      removed: [
        { id: "acme.cli.old" },
        {
          file: "public/prompts/setup.md",
          id: "site.prompts.setup",
          url: "/prompts/setup.md",
        },
      ],
    });

    expect(report).toContain("but some were removed.");
    expect(report).toContain(
      "### Removed since `origin/main`\n\n- `acme.cli.old`\n- `site.prompts.setup`: `public/prompts/setup.md`, served at `/prompts/setup.md`, which no longer works"
    );
  });
});
