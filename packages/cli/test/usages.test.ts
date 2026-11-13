import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

/** A project in a temp dir with the given config and files. */
const tempProject = async (
  config: string,
  files: Readonly<Record<string, string>>
) => {
  const root = await mkdtemp(path.join(tmpdir(), "copybook-usages-"));
  await writeFile(path.join(root, "copybook.config.mjs"), config);
  await Promise.all(
    Object.entries(files).map(async ([file, text]) => {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), text);
    })
  );
  return root;
};

const definition = (id: string) =>
  `{ [Symbol.for("copybook.def")]: true, id: "${id}", kind: "prompt", params: {}, template: () => "" }`;

describe("usages through require() and import()", () => {
  it("counts destructured, member, and namespace requires, and dynamic imports", async () => {
    const root = await tempProject(
      'export default { content: ["defs/*.mjs"], usage: { include: ["app/**/*"] } };',
      {
        "app/destructure.cjs":
          'const { greet, other: alias } = require("../defs/main.mjs");\n',
        "app/lazy.mjs": 'const lazy = await import("../defs/lazy.mjs");\n',
        "app/member.cjs":
          'const text = require("../defs/main.mjs").farewell;\n',
        "defs/lazy.mjs": `export const lazyOne = ${definition("site.lazy")};\n`,
        "defs/main.mjs": [
          `export const greet = ${definition("site.greet")};`,
          `export const farewell = ${definition("site.farewell")};`,
          `export const other = ${definition("site.other")};`,
          `export const unusedOne = ${definition("site.unused")};`,
        ].join("\n"),
      }
    );
    const report = await findUsages(await loadProject(root));

    expect(report).toStrictEqual({
      unused: ["site.unused"],
      usages: {
        "site.farewell": ["app/member.cjs"],
        "site.greet": ["app/destructure.cjs"],
        "site.lazy": ["app/lazy.mjs"],
        "site.other": ["app/destructure.cjs"],
      },
    });
  });
});

describe("usages in MDX", () => {
  it("counts imports in ESM blocks, not in code fences", async () => {
    const root = await tempProject(
      'export default { content: ["defs/*.mjs"], usage: { include: ["docs/**/*.mdx"] } };',
      {
        "defs/main.mjs": [
          `export const greet = ${definition("site.greet")};`,
          `export const farewell = ${definition("site.farewell")};`,
        ].join("\n"),
        "docs/guide.mdx": [
          "---",
          "title: Guide",
          "---",
          "",
          'import { greet } from "../defs/main.mjs";',
          'import { AgentPrompt } from "./agent-prompt";',
          "",
          "# Guide",
          "",
          "```ts",
          'import { farewell } from "../defs/main.mjs";',
          "```",
          "",
          "<AgentPrompt rendered={render(greet)} />",
        ].join("\n"),
      }
    );
    const report = await findUsages(await loadProject(root));

    expect(report).toStrictEqual({
      unused: ["site.farewell"],
      usages: { "site.greet": ["docs/guide.mdx"] },
    });
  });
});

describe("usages of Markdown prompts by URL", () => {
  it("counts whole URLs only, and every prompt that shares one", async () => {
    const root = await tempProject(
      [
        "export default {",
        '  markdown: [{ dir: "p", idPrefix: "site", url: "/prompts" }, { dir: "q", idPrefix: "mirror", url: "/prompts" }],',
        '  usage: { include: ["app/**/*"] },',
        "};",
      ].join("\n"),
      {
        "app/cta.mdx": '<CopyPrompt src="/prompts/a.md" />\n',
        "app/elsewhere.md":
          "See /docs/prompts/c.md, /prompts/c.mdx, and /prompts/c.md.bak.\n",
        "app/sentence.md": "Fetch https://acme.dev/prompts/b.md.\n",
        "p/a.md": "A\n",
        "p/b.md": "B\n",
        "p/c.md": "C\n",
        "q/a.md": "Mirror A\n",
      }
    );
    const report = await findUsages(await loadProject(root));

    expect(report).toStrictEqual({
      unused: ["site.c"],
      usages: {
        "mirror.a": ["app/cta.mdx"],
        "site.a": ["app/cta.mdx"],
        "site.b": ["app/sentence.md"],
      },
    });
  });
});
