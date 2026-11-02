import { defineCommand, definePrompt, p } from "@copybook/core";

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const RUNNERS: Record<PackageManager, string> = {
  bun: "bunx",
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
};

export const init = defineCommand({
  description:
    "Writes copybook.config.ts, installs @copybook/core and @copybook/cli, and sets up coding agents.",
  id: "site.cli.init",
  params: {
    packageManager: p.enum(PACKAGE_MANAGERS).default("npm"),
  },
  placements: ["site/docs/components"],
  template: (t, { packageManager }) =>
    t`${RUNNERS[packageManager]} @copybook/cli init`,
  title: "Initialize Copybook",
});

export const setupPrompt = definePrompt({
  id: "site.home.setup-agent",
  placements: ["site/home", "site/docs/components"],
  template: (t) => t`
    Set up Copybook in this project. Read https://copybook.dev/docs/quick-start.md first. Every docs page is listed at https://copybook.dev/llms.txt.
    1. Run ${t.cmd(init)}. It writes copybook.config.ts, installs @copybook/core and @copybook/cli, and sets up coding agents: an AGENTS.md section, the Copybook skill, and the copybook MCP server in .mcp.json.
    2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
    3. Render the definitions where the strings used to be, with the same props.
    4. Run ${t.cmd("npx copybook snapshot")}, then ${t.cmd("npx copybook check")}. Both must pass. ${t.cmd("npx copybook status --json")} lists anything left to do.
    5. Report which definitions you created, where they're shown, and anything you couldn't migrate.
  `,
  title: "Set up Copybook with a coding agent",
});

export const packageManagers = PACKAGE_MANAGERS;
