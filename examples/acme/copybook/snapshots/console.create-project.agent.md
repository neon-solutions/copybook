---
id: console.create-project.agent
kind: prompt
title: "Set up Acme with your coding agent"
source: src/create-project.ts#setUpWithAgent
placements:
  - console/create-project/done
params:
  orgId: org-summer-dust-12345678
  projectId: round-bar-12345678
embeds:
  - acme.cli.install
  - acme.cli.login
  - acme.cli.init
  - acme.cli.deploy
hash: sha256:a7bcdda7487fd64a
---

Set up this app on Acme.
1. npm i -g acme@latest. If that fails, use `npx acme@latest` in place of `acme`.
   If an acme command opens a browser sign-in, tell me to finish it there. If that times out or fails, ask me to run acme login, then retry.
2. In the project root:
   acme init -y --org-id org-summer-dust-12345678 --project-id round-bar-12345678 --branch production --services postgres
3. acme deploy. It provisions the services in acme.ts and pulls their env vars into `.env.local` (or `.env` if it exists).
4. Wire each service into the app's code using those env vars. Consult the installed Acme agent skills for best practices, e.g., what database driver to use given the app architecture and hosting runtime.
5. Prove it works: npm run build must pass, then start the app. Test each wired service end to end.
6. Report what changed, the command output that proves step 5, and anything that failed.
