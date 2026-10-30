import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // Vendored agent skills, managed by `skills` and skills-lock.json.
    ".agents/skills/**",
    ".claude/skills/**",
    "public/r/**",
    // Rendered snapshots must stay byte-for-byte what `copybook snapshot` wrote.
    "**/copybook/snapshots/**",
  ],
});
