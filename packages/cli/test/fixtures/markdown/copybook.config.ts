import { defineConfig } from "../../../src/config";

export default defineConfig({
  markdown: [
    {
      dir: "prompts",
      idPrefix: "fixture.prompts",
      meta: { "setup.md": { placements: ["docs/setup"] } },
      owners: ["docs"],
      url: "/prompts",
    },
    { dir: "notes", frontmatter: "strip", idPrefix: "fixture.notes" },
  ],
  placements: { "docs/notes": {}, "docs/setup": {} },
  usage: { include: ["app/**/*.{mdx,tsx}"] },
});
