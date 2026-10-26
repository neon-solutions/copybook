import { defineCommand, p, skip } from "@prompt-manager/core";

import { branch, orgId, projectId } from "./params";

export const install = defineCommand({
  id: "acme.cli.install",
  template: (t) => t`npm i -g acme@latest`,
  title: "Install the Acme CLI",
  verify: "syntax",
});

export const login = defineCommand({
  id: "acme.cli.login",
  template: (t) => t`acme login`,
  title: "Log in",
  verify: skip("interactive: opens a browser sign-in"),
});

const SERVICES = [
  "postgres",
  "storage",
  "ai-gateway",
  "data-api",
  "auth",
] as const;

export const init = defineCommand({
  id: "acme.cli.init",
  params: {
    branch,
    orgId,
    projectId,
    services: p.enum(SERVICES).default("postgres"),
  },
  template: (t, values) =>
    t`acme init -y --org-id ${values.orgId} --project-id ${values.projectId} --branch ${values.branch} --services ${values.services}`,
  title: "Link the project folder",
  verify: "syntax",
});

export const deploy = defineCommand({
  description: "Provisions the services in acme.ts and pulls their env vars.",
  id: "acme.cli.deploy",
  template: (t) => t`acme deploy`,
  title: "Provision services and pull env vars",
  verify: "syntax",
});

export const psql = defineCommand({
  id: "acme.connect.psql",
  placements: ["console/projects/footer"],
  template: (t) => t`psql -h pg.acme.dev`,
  title: "Passwordless connect with psql",
  verify: skip("interactive: opens a psql session"),
});
