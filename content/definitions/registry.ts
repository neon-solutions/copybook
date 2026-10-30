import { defineCommand, p } from "@copybook/core";

import { packageManagers, RUNNERS } from "./get-started";

export const addComponent = defineCommand({
  id: "site.registry.add",
  params: {
    item: p.string().example("agent-prompt"),
    packageManager: p.enum(packageManagers).default("npm"),
    registryUrl: p.url().example("https://copybook.dev/r"),
  },
  placements: ["site/docs/components"],
  template: (t, { item, packageManager, registryUrl }) =>
    t`${RUNNERS[packageManager]} shadcn@latest add ${registryUrl}/${item}.json`,
  title: "Add a registry component",
});
