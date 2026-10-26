import { existsSync } from "node:fs";
import path from "node:path";

import { bundleAndImport } from "./bundle";

export interface PlacementInfo {
  description?: string;
  /** The product route that shows this placement, such as `/projects/[id]`. */
  route?: string;
}

export interface Config {
  /** Globs of files that export definitions, relative to the config file. */
  content: string[];
  /** Globs to leave out, even when `content` matches them. */
  exclude?: string[];
  /**
   * Known placements. When set, `check` fails on definitions that declare
   * a placement that isn't listed.
   */
  placements?: Record<string, PlacementInfo>;
  snapshots?: {
    /** Where rendered snapshots are written. Defaults to `prompt-manager/snapshots`. */
    dir?: string;
  };
  /**
   * Module specifiers to replace with empty modules when loading content,
   * such as `server-only`. CSS imports are always stubbed.
   */
  stubs?: string[];
  /** The tsconfig used to resolve path aliases. Defaults to `tsconfig.json`. */
  tsconfig?: string;
  /**
   * Globs of files that export `defineTest` and `defineEval` specs. Your
   * product never imports these.
   */
  verify?: string[];
}

export interface ResolvedConfig extends Config {
  /** The directory that holds the config file. Globs are relative to it. */
  root: string;
  snapshotsDir: string;
}

export const CONFIG_FILES = [
  "prompt-manager.config.ts",
  "prompt-manager.config.mts",
  "prompt-manager.config.js",
  "prompt-manager.config.mjs",
] as const;

/** Declares a config with types. */
export const defineConfig = (config: Config): Config => config;

const DEFAULT_SNAPSHOTS_DIR = "prompt-manager/snapshots";

export const findConfig = (cwd: string): string | undefined => {
  let directory = path.resolve(cwd);
  for (;;) {
    for (const file of CONFIG_FILES) {
      const candidate = path.join(directory, file);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return;
    }
    directory = parent;
  }
};

const isConfig = (value: unknown): value is Config =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as Config).content);

export const loadConfig = async (
  cwd: string,
  configPath?: string
): Promise<ResolvedConfig> => {
  const file = configPath ? path.resolve(cwd, configPath) : findConfig(cwd);
  if (!file || !existsSync(file)) {
    throw new Error(
      "No prompt-manager.config.ts found. Run `prompt-manager init` to create one."
    );
  }
  const root = path.dirname(file);
  const loaded = await bundleAndImport({
    contents: `export { default } from ${JSON.stringify(file)};`,
    name: "config",
    root,
  });
  const config = loaded.default;
  if (!isConfig(config)) {
    throw new Error(
      `${path.relative(cwd, file)} must default-export defineConfig({ content: [...] }).`
    );
  }
  return {
    ...config,
    root,
    snapshotsDir: path.resolve(
      root,
      config.snapshots?.dir ?? DEFAULT_SNAPSHOTS_DIR
    ),
  };
};
