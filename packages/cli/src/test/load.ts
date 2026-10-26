import path from "node:path";

import { glob } from "tinyglobby";

import { bundleAndImport } from "../bundle";
import type { ResolvedConfig } from "../config";
import { isEvalSpec } from "../eval/define";
import type { EvalSpec } from "../eval/define";
import { isTestSpec } from "./define";
import type { TestSpec } from "./define";

const loadVerifyModules = async (
  config: ResolvedConfig
): Promise<Record<string, unknown>[]> => {
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
  return loaded.modules as Record<string, unknown>[];
};

const collect = <T>(
  modules: readonly Record<string, unknown>[],
  guard: (value: unknown) => value is T
): T[] =>
  modules.flatMap((namespace) =>
    Object.values(namespace).flatMap((value) => {
      if (guard(value)) {
        return [value];
      }
      return Array.isArray(value) ? value.filter(guard) : [];
    })
  );

/** Loads every `defineTest` exported from the config's `verify` globs. */
export const loadTestSpecs = async (
  config: ResolvedConfig
): Promise<TestSpec[]> => collect(await loadVerifyModules(config), isTestSpec);

/** Loads every `defineEval` exported from the config's `verify` globs. */
export const loadEvalSpecs = async (
  config: ResolvedConfig
): Promise<EvalSpec[]> => collect(await loadVerifyModules(config), isEvalSpec);
