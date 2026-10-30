import { defineConfig } from "../../../src/config";

export default defineConfig({
  content: ["src/**/*.ts"],
  placements: { "docs/home": {} },
  stubs: ["server-only"],
  usage: { include: ["app/**/*.tsx"] },
});
