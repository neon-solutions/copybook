import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";
import type { Options } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf-8")) as {
  version: string;
};

const shared: Options = {
  define: { __PM_VERSION__: JSON.stringify(version) },
  format: ["esm"],
  platform: "node",
  sourcemap: true,
  target: "node22",
};

export default defineConfig([
  { ...shared, clean: true, dts: true, entry: ["src/index.ts"] },
  { ...shared, banner: { js: "#!/usr/bin/env node" }, entry: ["src/bin.ts"] },
]);
