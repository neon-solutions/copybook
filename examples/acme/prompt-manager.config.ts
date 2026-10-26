import { defineConfig } from "@prompt-manager/cli";

export default defineConfig({
  content: ["src/**/*.ts"],
  placements: {
    "console/ai-gateway/model": { route: "/projects/[id]/ai-gateway/[model]" },
    "console/branch/connect-dialog": {
      route: "/projects/[id]/branches/[branch]",
    },
    "console/create-project/done": { route: "/projects/new" },
    "console/projects/footer": { route: "/projects" },
  },
  verify: ["verify/**/*.verify.ts"],
});
