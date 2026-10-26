import { defineCommand, definePrompt, p } from "@prompt-manager/core";

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export const RUNNERS: Record<PackageManager, string> = {
  bun: "bunx",
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
};

export const init = defineCommand({
  description: "Adds @prompt-manager/core and a prompt-manager.config.ts.",
  id: "site.cli.init",
  params: {
    packageManager: p.enum(PACKAGE_MANAGERS).default("npm"),
  },
  placements: ["site/home/get-started"],
  template: (t, { packageManager }) =>
    t`${RUNNERS[packageManager]} @prompt-manager/cli init`,
  title: "Initialize Prompt Manager",
});

export const setupPrompt = definePrompt({
  id: "site.home.setup-agent",
  placements: ["site/home/get-started"],
  template: (t) => t`
    Set up Prompt Manager in this project.
    1. Run ${t.cmd(init)}. It adds @prompt-manager/core and a prompt-manager.config.ts.
    2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
    3. Render the definitions where the strings used to be, with the same props.
    4. Run ${t.cmd("npx prompt-manager snapshot")}, then ${t.cmd("npx prompt-manager check")}. Both must pass.
    5. Report which definitions you created, where they're shown, and anything you couldn't migrate.
  `,
  title: "Set up Prompt Manager with a coding agent",
});

export const packageManagers = PACKAGE_MANAGERS;
