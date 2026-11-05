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
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/gu;
/** A URL that continues past a match, such as `a.md` inside `a.mdx`, isn't a match. */
const PATH_CHAR = /[\w./-]/u;

/**
 * A matcher for the URLs Markdown prompts are served at, such as
 * `/prompts/setup.md`, or nothing when no prompt has a URL.
 */
const urlMatcher = (project: Project) => {
  const byUrl = new Map<string, string>();
  for (const { definition, markdown } of project.definitions) {
    if (markdown?.url) {
      byUrl.set(markdown.url, definition.id);
    }
  }
  if (byUrl.size === 0) {
    return;
  }
  // Longest first, so a URL never stops a longer one from matching.
  const pattern = [...byUrl.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map((url) => url.replaceAll(REGEXP_SPECIAL, String.raw`\$&`))
    .join("|");
  const regexp = new RegExp(pattern, "gu");
  return (source: string): string[] => {
    const ids: string[] = [];
    for (const match of source.matchAll(regexp)) {
      const next = source[match.index + match[0].length] ?? "";
      const id = byUrl.get(match[0]);
      if (id && !PATH_CHAR.test(next)) {
        ids.push(id);
      }
    }
    return ids;
  };
};

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
 * project's tsconfig paths. Type-only imports don't count. Markdown prompts
 * with a `url` are used by every file that contains their URL, Markdown and
 * MDX included.
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
  const record = (id: string, file: string) => {
    const relative = path.relative(config.root, file).split(path.sep).join("/");
    usages.set(id, (usages.get(id) ?? new Set()).add(relative));
  };
  const urlsIn = urlMatcher(project);
  const sources = await Promise.all(
    files.map((file) => readFile(file, "utf-8"))
  );
  for (const [index, file] of files.entries()) {
    const source = sources[index] ?? "";
    for (const id of urlsIn?.(source) ?? []) {
      record(id, file);
    }
    if (!EXTENSIONS.includes(path.extname(file))) {
      continue;
    }
    const { module } = parseSync(file, source);
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
          record(id, file);
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
