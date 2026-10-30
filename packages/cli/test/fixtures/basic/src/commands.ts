import "server-only";
import { defineCommand, p } from "@copybook/core";

export const hello = defineCommand({
  id: "fixture.hello",
  params: { name: p.string().example("world") },
  placements: ["docs/home"],
  template: (t, { name }) => t`echo hello ${name}`,
});
