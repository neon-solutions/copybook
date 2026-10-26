import path from "node:path";

import { glob } from "tinyglobby";

import { bundleAndImport } from "../bundle";
import type { ResolvedConfig } from "../config";
import { isTestSpec } from "./define";
import type { TestSpec } from "./define";

/** Loads every `defineTest` exported from the config's `verify` globs. */
export const loadTestSpecs = async (
  config: ResolvedConfig
): Promise<TestSpec[]> => {
  if (!config.verify || config.verify.length === 0) {
    return [];
  }
  const files = await glob(config.verify, {
    cwd: config.root,
    ignore: ["**/node_modules/**"],
  });
  if (files.length === 0) {
    return [];
  }
  const imports = files.map(
    (file, index) =>
      `import * as v${index} from ${JSON.stringify(path.resolve(config.root, file))};`
  );
  const loaded = await bundleAndImport({
    contents: `${imports.join("\n")}\nexport const modules = [${files.map((_, index) => `v${index}`).join(", ")}];`,
    name: "verify",
    root: config.root,
    ...(config.stubs ? { stubs: config.stubs } : {}),
    ...(config.tsconfig ? { tsconfig: config.tsconfig } : {}),
  });
  const modules = loaded.modules as Record<string, unknown>[];
  return modules.flatMap((namespace) =>
    Object.values(namespace).flatMap((value) => {
      if (isTestSpec(value)) {
        return [value];
      }
      return Array.isArray(value) ? value.filter(isTestSpec) : [];
    })
  );
};
