import { defineConfig } from "@copybook/cli";

// The site dogfoods Copybook: its install commands and setup prompt
// are definitions, snapshotted and checked in CI.
export default defineConfig({
  content: ["content/definitions/**/*.ts"],
  placements: {
    "site/docs/components": { route: "/docs/components/*" },
    "site/home": { route: "/" },
  },
  usage: { include: ["app/**/*.tsx", "components/**/*.tsx"] },
});
