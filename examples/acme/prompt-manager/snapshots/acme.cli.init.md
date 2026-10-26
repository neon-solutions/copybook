---
id: acme.cli.init
kind: command
title: "Link the project folder"
source: src/commands.ts#init
placements: []
params:
  branch: production
  orgId: org-summer-dust-12345678
  projectId: round-bar-12345678
  services: postgres
embeds: []
hash: sha256:bbd96a979aae0c20
---

```sh
acme init -y --org-id org-summer-dust-12345678 --project-id round-bar-12345678 --branch production --services postgres
```
