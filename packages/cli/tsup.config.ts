import { cpSync, existsSync, readFileSync } from "node:fs";

import { defineConfig } from "tsup";
import type { Options } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf-8")) as {
  version: string;
};

const STUDIO_DIST = "../studio/dist";

const shared: Options = {
  define: { __COPYBOOK_VERSION__: JSON.stringify(version) },
  format: ["esm"],
  platform: "node",
  sourcemap: true,
  target: "node22",
};

export default defineConfig([
  {
    ...shared,
    clean: true,
    dts: true,
    entry: ["src/index.ts"],
    // Ship the prebuilt Studio UI next to the CLI bundle.
    onSuccess: () => {
      if (existsSync(STUDIO_DIST)) {
        cpSync(STUDIO_DIST, "dist/studio", { recursive: true });
      }
      return Promise.resolve();
    },
  },
  { ...shared, banner: { js: "#!/usr/bin/env node" }, entry: ["src/bin.ts"] },
]);
