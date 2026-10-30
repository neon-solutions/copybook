import { p } from "@copybook/core";

/** Params shared across the Acme console. */
export const orgId = p.string().example("org-summer-dust-12345678");
export const projectId = p.string().example("round-bar-12345678");
export const branch = p.string().default("production");
export const endpoint = p
  .url()
  .example("https://br-fancy-king-a1b2c3d4.us-east-2.acme.dev")
  .describe("The branch endpoint");
