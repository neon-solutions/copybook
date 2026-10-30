import path from "node:path";

import { isCollection, isDefinition } from "@copybook/core";
import type { Definition } from "@copybook/core";
import { glob } from "tinyglobby";

import { bundleAndImport } from "./bundle";
import { loadConfig } from "./config";
import type { ResolvedConfig } from "./config";

export interface LoadedDefinition {
  definition: Definition;
  /** The export that holds it, such as `connect` or `models[gpt-5-mini]`. */
  exportName: string;
  /** Relative to the config root, with forward slashes. */
  file: string;
}

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
 * Collects definitions from loaded modules. The same definition exported
 * twice counts once; two definitions with one id are an error.
 */
export const collectDefinitions = (
  modules: Readonly<Record<string, Record<string, unknown>>>
): LoadedDefinition[] => {
  const byId = new Map<string, LoadedDefinition>();
  const seen = new Set<Definition>();

  for (const [file, namespace] of Object.entries(modules)) {
    for (const [name, value] of Object.entries(namespace)) {
      for (const found of definitionsIn(name, value)) {
        if (seen.has(found.definition)) {
          continue;
        }
        seen.add(found.definition);
        const existing = byId.get(found.definition.id);
        if (existing) {
          throw new Error(
            `Duplicate id "${found.definition.id}" in ${existing.file}#${existing.exportName} and ${file}#${found.exportName}.`
          );
        }
        byId.set(found.definition.id, { ...found, file });
      }
    }
  }

  return [...byId.values()].toSorted((a, b) =>
    a.definition.id.localeCompare(b.definition.id)
  );
};

export const findContentFiles = async (config: ResolvedConfig) => {
  const files = await glob(config.content, {
    cwd: config.root,
    ignore: [...DEFAULT_EXCLUDE, ...(config.exclude ?? [])],
  });
  return files.toSorted();
};

/** Loads the config and every definition its `content` globs export. */
export const loadProject = async (
  cwd: string,
  options: { config?: string } = {}
): Promise<Project> => {
  const config = await loadConfig(cwd, options.config);
  const files = await findContentFiles(config);
  if (files.length === 0) {
    return { config, definitions: [] };
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

  const modules = loaded.modules as Record<string, Record<string, unknown>>;
  return { config, definitions: collectDefinitions(modules) };
};
