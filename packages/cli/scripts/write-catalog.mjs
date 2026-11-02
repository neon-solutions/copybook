// Writes dist/catalog.json from the built CLI, so the site and agents can
// read every command and flag without loading the CLI.
import { writeFileSync } from "node:fs";

import { buildCatalog, createProgram } from "../dist/index.js";

writeFileSync(
  new URL("../dist/catalog.json", import.meta.url),
  `${JSON.stringify(buildCatalog(createProgram()), null, 2)}\n`
);
