import { defineConfig } from "@copybook/cli";

export default defineConfig({
  content: ["src/**/*.ts"],
  // Prompts the docs site serves as Markdown files at /prompts/*.md.
  markdown: [
    {
      dir: "public/prompts",
      idPrefix: "site.prompts",
      meta: { "nextjs.md": { placements: ["docs/guides/framework"] } },
      owners: ["docs"],
      url: "/prompts",
    },
  ],
  placements: {
    "console/ai-gateway/model": { route: "/projects/[id]/ai-gateway/[model]" },
    "console/branch/connect-dialog": {
      route: "/projects/[id]/branches/[branch]",
    },
    "console/create-project/done": { route: "/projects/new" },
    "console/projects/footer": { route: "/projects" },
    "docs/guides/framework": { route: "/docs/guides/[framework]" },
  },
  usage: { include: ["console/**/*.tsx", "docs/**/*.mdx"] },
  verify: ["verify/**/*.verify.ts"],
});
