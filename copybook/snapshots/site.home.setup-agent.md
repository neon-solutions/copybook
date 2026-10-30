---
id: site.home.setup-agent
kind: prompt
title: "Set up Copybook with a coding agent"
source: content/definitions/get-started.ts#setupPrompt
placements:
  - site/docs/components
params: {}
embeds:
  - site.cli.init
hash: sha256:e2ce1ed044e4db9d
---

Set up Copybook in this project.
1. Run npx @copybook/cli init. It adds @copybook/core and a copybook.config.ts.
2. Find the code snippets, shell commands, and coding-agent prompts that the UI shows to users. Move each one into a definition with defineSnippet, defineCommand, or definePrompt. Give each a stable dotted id, typed params with example values, and the placements where it's shown.
3. Render the definitions where the strings used to be, with the same props.
4. Run npx copybook snapshot, then npx copybook check. Both must pass.
5. Report which definitions you created, where they're shown, and anything you couldn't migrate.
