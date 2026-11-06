import { existsSync } from "node:fs";
import path from "node:path";

import { bundleAndImport } from "./bundle";
import { CopybookError } from "./errors";

export interface PlacementInfo {
  description?: string;
  /** The product route that shows this placement, such as `/projects/[id]`. */
  route?: string;
}

/** Metadata for a Markdown prompt. */
export interface MarkdownMeta {
  aliases?: string[];
  description?: string;
  owners?: string[];
  placements?: string[];
  tags?: string[];
  title?: string;
}

/** A directory of Markdown files, each one a prompt. */
export interface MarkdownSource {
  /** The directory, relative to the config file. */
  dir: string;
  /** Globs inside `dir` to leave out. */
  exclude?: string[];
  /**
   * `keep` (the default): frontmatter is part of the prompt, and only its
   * `title` and `description` are read. `strip`: frontmatter holds the
   * prompt's metadata and isn't part of the prompt.
   */
  frontmatter?: "keep" | "strip";
  /**
   * Ids are `<idPrefix>.<path in dir>`, without the extension and with
   * `/` as `.`: `setup/agent.md` is `<idPrefix>.setup.agent`.
   */
  idPrefix: string;
  /** Globs inside `dir`. Defaults to `**\/*.md`. */
  include?: string[];
  /** Metadata for single files, keyed by their path in `dir`. */
  meta?: Record<string, MarkdownMeta>;
  /** Owners of every prompt in `dir`. */
  owners?: string[];
  /** Placements of every prompt in `dir`. */
  placements?: string[];
  /** Tags of every prompt in `dir`. */
  tags?: string[];
  /**
   * The URL path your product serves `dir` at, such as `/prompts`. Usage
   * scanning looks for `<url>/<path in dir>` in `usage.include` files.
   */
  url?: string;
}

export interface Config {
  /**
   * Globs of files that export definitions, relative to the config file.
   * Required unless `markdown` is set.
   */
  content?: string[];
  /** Globs to leave out, even when `content` matches them. */
  exclude?: string[];
  /** Directories of Markdown prompts. Each file is its own snapshot. */
  markdown?: MarkdownSource[];
  /**
   * Known placements. When set, `check` fails on definitions that declare
   * a placement that isn't listed.
   */
  placements?: Record<string, PlacementInfo>;
  snapshots?: {
    /** Where rendered snapshots are written. Defaults to `copybook/snapshots`. */
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
   * Product files to scan for imports of definitions, so `usages`, `check`,
   * and Studio can show where each one is actually rendered.
   */
  usage?: {
    exclude?: string[];
    include: string[];
  };
  /**
   * Globs of files that export `defineTest` and `defineEval` specs. Your
   * product never imports these.
   */
  verify?: string[];
}

export interface ResolvedConfig extends Config {
  /** The config file's absolute path. */
  file: string;
  /** The directory that holds the config file. Globs are relative to it. */
  root: string;
  snapshotsDir: string;
}

export const CONFIG_FILES = [
  "copybook.config.ts",
  "copybook.config.mts",
  "copybook.config.js",
  "copybook.config.mjs",
] as const;

/** Declares a config with types. */
export const defineConfig = (config: Config): Config => config;

const DEFAULT_SNAPSHOTS_DIR = "copybook/snapshots";

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

const isMarkdownSource = (value: unknown): value is MarkdownSource =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as MarkdownSource).dir === "string" &&
  typeof (value as MarkdownSource).idPrefix === "string";

const isConfig = (value: unknown): value is Config => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { content, markdown } = value as Config;
  const hasContent = Array.isArray(content);
  const hasMarkdown = Array.isArray(markdown);
  const markdownValid = !hasMarkdown || markdown.every(isMarkdownSource);
  return (hasContent || hasMarkdown) && markdownValid;
};

const resolveConfig = (
  config: unknown,
  file: string,
  label: string
): ResolvedConfig => {
  if (!isConfig(config)) {
    throw new CopybookError(
      "CONFIG_INVALID",
      `${label} must default-export defineConfig({ content: [...] }) or defineConfig({ markdown: [{ dir, idPrefix }] }).`
    );
  }
  const root = path.dirname(file);
  return {
    ...config,
    file,
    root,
    snapshotsDir: path.resolve(
      root,
      config.snapshots?.dir ?? DEFAULT_SNAPSHOTS_DIR
    ),
  };
};

export const loadConfig = async (
  cwd: string,
  configPath?: string
): Promise<ResolvedConfig> => {
  const file = configPath ? path.resolve(cwd, configPath) : findConfig(cwd);
  if (!file || !existsSync(file)) {
    throw new CopybookError(
      "CONFIG_NOT_FOUND",
      "No copybook.config.ts found. Run `copybook init` to create one.",
      {
        next: [
          {
            argv: ["init"],
            code: "init",
            command: "copybook init",
            safe: false,
            title: "Create copybook.config.ts",
          },
        ],
      }
    );
  }
  const root = path.dirname(file);
  const loaded = await bundleAndImport({
    contents: `export { default } from ${JSON.stringify(file)};`,
    name: "config",
    root,
  });
  return resolveConfig(loaded.default, file, path.relative(cwd, file));
};

/**
 * Loads a config from its source text, such as the config at a git base.
 * Its imports resolve from the directory of `file`, where it lives now.
 */
export const loadConfigSource = async (
  contents: string,
  file: string
): Promise<ResolvedConfig> => {
  const loaded = await bundleAndImport({
    contents,
    name: "config-base",
    root: path.dirname(file),
  });
  return resolveConfig(loaded.default, file, path.basename(file));
};
