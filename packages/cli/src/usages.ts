import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSync } from "oxc-parser";
import { ResolverFactory } from "oxc-resolver";
import { glob } from "tinyglobby";

import type { Project } from "./load";

export interface UsageReport {
  /** Definition id → product files that import it, relative to the config. */
  usages: Record<string, string[]>;
  /**
   * Definitions that no scanned file imports, and that aren't embedded in a
   * definition that one does.
   */
  unused: string[];
}

/** Everything reachable from `roots` through embeds. */
const reachable = (
  roots: Iterable<string>,
  embeds: ReadonlyMap<string, readonly string[]>
) => {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.pop();
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      queue.push(...(embeds.get(id) ?? []));
    }
  }
  return seen;
};

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];
const BASE_EXPORT = /^[^.[]+/u;

/** content file → export name → the ids it holds. */
const indexExports = (project: Project) => {
  const index = new Map<string, Map<string, string[]>>();
  for (const { definition, exportName, file } of project.definitions) {
    const absolute = path.resolve(project.config.root, file);
    const name = BASE_EXPORT.exec(exportName)?.[0] ?? exportName;
    const byName = index.get(absolute) ?? new Map<string, string[]>();
    byName.set(name, [...(byName.get(name) ?? []), definition.id]);
    index.set(absolute, byName);
  }
  return index;
};

const importedIds = (
  byName: ReadonlyMap<string, string[]>,
  kind: string,
  name: string | null
) => {
  if (kind === "NamespaceObject") {
    return [...byName.values()].flat();
  }
  return byName.get(kind === "Default" ? "default" : (name ?? "")) ?? [];
};

/**
 * Finds which product files import each definition, by parsing the files the
 * config's `usage.include` globs match and resolving their imports with the
 * project's tsconfig paths. Type-only imports don't count.
 */
export const findUsages = async (
  project: Project,
  embeds: ReadonlyMap<string, readonly string[]> = new Map()
): Promise<UsageReport | undefined> => {
  const { config } = project;
  if (!config.usage) {
    return;
  }
  const exportsByFile = indexExports(project);
  const tsconfig = path.resolve(
    config.root,
    config.tsconfig ?? "tsconfig.json"
  );
  const resolver = new ResolverFactory({
    conditionNames: ["import", "module", "default"],
    extensions: EXTENSIONS,
    ...(existsSync(tsconfig)
      ? { tsconfig: { configFile: tsconfig, references: "auto" } }
      : {}),
  });
  const files = await glob(config.usage.include, {
    absolute: true,
    cwd: config.root,
    ignore: ["**/node_modules/**", ...(config.usage.exclude ?? [])],
  });

  const usages = new Map<string, Set<string>>();
  const sources = await Promise.all(
    files.map((file) => readFile(file, "utf-8"))
  );
  for (const [index, file] of files.entries()) {
    const { module } = parseSync(file, sources[index] ?? "");
    for (const statement of module.staticImports) {
      const target = resolver.resolveFileSync(
        file,
        statement.moduleRequest.value
      ).path;
      const byName = target ? exportsByFile.get(target) : undefined;
      if (!byName) {
        continue;
      }
      for (const entry of statement.entries) {
        if (entry.isType) {
          continue;
        }
        const kind = String(entry.importName.kind);
        for (const id of importedIds(byName, kind, entry.importName.name)) {
          const relative = path
            .relative(config.root, file)
            .split(path.sep)
            .join("/");
          usages.set(id, (usages.get(id) ?? new Set()).add(relative));
        }
      }
    }
  }

  const ids = project.definitions.map(({ definition }) => definition.id);
  const used = reachable(usages.keys(), embeds);
  return {
    unused: ids.filter((id) => !used.has(id)),
    usages: Object.fromEntries(
      ids.flatMap((id) => {
        const found = usages.get(id);
        return found ? [[id, [...found].toSorted()]] : [];
      })
    ),
  };
};
