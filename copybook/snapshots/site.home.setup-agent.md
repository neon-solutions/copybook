---
id: site.home.setup-agent
kind: prompt
title: "Set up Copybook with a coding agent"
source: content/definitions/get-started.ts#setupPrompt
placements:
  - site/home
  - site/docs/components
params: {}
embeds:
  - site.cli.init
hash: sha256:e9233edb72d6bc95
---

Set up Copybook in this project. Read https://copybook.dev/docs/quick-start.md first. Every docs page is listed at https://copybook.dev/llms.txt.
1. Run npx @copybook/cli init. It writes copybook.config.ts, installs @copybook/core and @copybook/cli, and sets up coding agents: an AGENTS.md section, the Copybook skill, and the copybook MCP server in .mcp.json.
2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
3. Render the definitions where the strings used to be, with the same props.
4. Run npx copybook snapshot, then npx copybook check. Both must pass. npx copybook status --json lists anything left to do.
5. Report which definitions you created, where they're shown, and anything you couldn't migrate.
