/** Commands and the agent prompt shown in the landing page's get-started block. */
export const INIT_COMMANDS = {
  bun: "bunx @prompt-manager/cli init",
  npm: "npx @prompt-manager/cli init",
  pnpm: "pnpm dlx @prompt-manager/cli init",
  yarn: "yarn dlx @prompt-manager/cli init",
} as const;

export const SETUP_AGENT_PROMPT = `Set up Prompt Manager in this project.
1. Run \`npx @prompt-manager/cli init\`. It adds @prompt-manager/core and a prompt-manager.config.ts.
2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
3. Render the definitions where the strings used to be, with the same props.
4. Run \`npx prompt-manager snapshot\`, then \`npx prompt-manager check\`. Both must pass.
5. Report which definitions you created, where they're shown, and anything you couldn't migrate.`;
