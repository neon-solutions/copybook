import path from "node:path";

import { isCollection, isDefinition } from "@copybook/core";
import type { Definition } from "@copybook/core";
import { glob } from "tinyglobby";

import { bundleAndImport } from "./bundle";
import { loadConfig } from "./config";
import type { ResolvedConfig } from "./config";
import { CopybookError } from "./errors";
import { loadMarkdown } from "./markdown";

export interface LoadedDefinition {
  definition: Definition;
  /**
   * The export that holds it, such as `connect` or `models[gpt-5-mini]`.
   * Empty for a Markdown file.
   */
  exportName: string;
  /** Relative to the config root, with forward slashes. */
  file: string;
  /** Set for a Markdown file, which is its own snapshot. */
  markdown?: {
    /** The file's raw text. */
    text: string;
    /** Where the product serves it, such as `/prompts/setup.md`. */
    url?: string;
  };
}

/** Where a definition is declared: `file#export`, or just the file. */
export const sourceLabel = ({
  exportName,
  file,
}: Pick<LoadedDefinition, "exportName" | "file">) =>
  exportName === "" ? file : `${file}#${exportName}`;

export interface Project {
  config: ResolvedConfig;
  definitions: LoadedDefinition[];
}

const DEFAULT_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/.next/**"];

/** Finds definitions in an export, one level into arrays and objects. */
const definitionsIn = (
  exportName: string,
  value: unknown
): { definition: Definition; exportName: string }[] => {
  if (isDefinition(value)) {
    return [{ definition: value, exportName }];
  }
  if (isCollection(value)) {
    return [...value.definitions].map(([key, definition]) => ({
      definition,
      exportName: `${exportName}[${key}]`,
    }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      isDefinition(item)
        ? [{ definition: item, exportName: `${exportName}[${index}]` }]
        : []
    );
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      isDefinition(item)
        ? [{ definition: item, exportName: `${exportName}.${key}` }]
        : []
    );
  }
  return [];
};

/**
 * Merges definitions from every source, sorted by id. Two definitions with
 * one id are an error.
 */
export const mergeDefinitions = (
  ...lists: readonly (readonly LoadedDefinition[])[]
): LoadedDefinition[] => {
  const byId = new Map<string, LoadedDefinition>();
  for (const loaded of lists.flat()) {
    const existing = byId.get(loaded.definition.id);
    if (existing) {
      throw new CopybookError(
        "DUPLICATE_ID",
        `Duplicate id "${loaded.definition.id}" in ${sourceLabel(existing)} and ${sourceLabel(loaded)}.`
      );
    }
    byId.set(loaded.definition.id, loaded);
  }
  return [...byId.values()].toSorted((a, b) =>
    a.definition.id.localeCompare(b.definition.id)
  );
};

/**
 * Collects definitions from loaded modules. The same definition exported
 * twice counts once; two definitions with one id are an error.
 */
export const collectDefinitions = (
  modules: Readonly<Record<string, Record<string, unknown>>>
): LoadedDefinition[] => {
  const found: LoadedDefinition[] = [];
  const seen = new Set<Definition>();

  for (const [file, namespace] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(namespace)) {
      for (const item of definitionsIn(name, value)) {
        if (!seen.has(item.definition)) {
          seen.add(item.definition);
          found.push({ ...item, file });
        }
      }
    }
  }

  return mergeDefinitions(found);
};

export const findContentFiles = async (config: ResolvedConfig) => {
  const files = await glob(config.content ?? [], {
    cwd: config.root,
    ignore: [...DEFAULT_EXCLUDE, ...(config.exclude ?? [])],
  });
  return files.toSorted();
};

const loadModules = async (
  config: ResolvedConfig
): Promise<LoadedDefinition[]> => {
  const files = await findContentFiles(config);
  if (files.length === 0) {
    return [];
  }

  const imports = files.map(
    (file, index) =>
      `import * as m${index} from ${JSON.stringify(path.resolve(config.root, file))};`
  );
  const entries = files.map(
    (file, index) => `${JSON.stringify(file)}: m${index}`
  );
  const loaded = await bundleAndImport({
    contents: `${imports.join("\n")}\nexport const modules = { ${entries.join(", ")} };`,
    name: "content",
    root: config.root,
    ...(config.stubs ? { stubs: config.stubs } : {}),
    ...(config.tsconfig ? { tsconfig: config.tsconfig } : {}),
  });

  return collectDefinitions(
    loaded.modules as Record<string, Record<string, unknown>>
  );
};

/**
 * Loads the config, every definition its `content` globs export, and every
 * file its `markdown` sources match.
 */
export const loadProject = async (
  cwd: string,
  options: { config?: string } = {}
): Promise<Project> => {
  const config = await loadConfig(cwd, options.config);
  const [modules, markdown] = await Promise.all([
    loadModules(config),
    loadMarkdown(config, DEFAULT_EXCLUDE),
  ]);
  const files = markdown.map(
    ({ definition, file, text, url }): LoadedDefinition => ({
      definition,
      exportName: "",
      file,
      markdown: url === undefined ? { text } : { text, url },
    })
  );
  return { config, definitions: mergeDefinitions(modules, files) };
};
