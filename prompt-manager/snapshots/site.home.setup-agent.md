---
id: site.home.setup-agent
kind: prompt
title: "Set up Prompt Manager with a coding agent"
source: content/definitions/get-started.ts#setupPrompt
placements:
  - site/home/get-started
params: {}
embeds:
  - site.cli.init
hash: sha256:5747650a553a09a7
---

Set up Prompt Manager in this project.
1. Run npx @prompt-manager/cli init. It adds @prompt-manager/core and a prompt-manager.config.ts.
2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
3. Render the definitions where the strings used to be, with the same props.
4. Run npx prompt-manager snapshot, then npx prompt-manager check. Both must pass.
5. Report which definitions you created, where they're shown, and anything you couldn't migrate.
