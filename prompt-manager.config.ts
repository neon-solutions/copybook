import { defineConfig } from "@prompt-manager/cli";

// The site dogfoods Prompt Manager: its install commands and setup prompt
// are definitions, snapshotted and checked in CI.
export default defineConfig({
  content: ["content/definitions/**/*.ts"],
  placements: {
    "site/docs/components": { route: "/docs/components/*" },
    "site/home/get-started": { route: "/" },
  },
  usage: { include: ["app/**/*.tsx", "components/**/*.tsx"] },
});
