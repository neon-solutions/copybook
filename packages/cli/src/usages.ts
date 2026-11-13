import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSync } from "oxc-parser";
import { ResolverFactory } from "oxc-resolver";
import { glob } from "tinyglobby";

import { escapeRegExp } from "./bundle";
import type { Project } from "./load";
import { mdxEsm } from "./mdx";
import { moduleUses, NAMESPACE } from "./module-uses";
import type { ModuleUse } from "./module-uses";

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

const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];
const MDX = ".mdx";
const BASE_EXPORT = /^[^.[]+/u;
/** The path goes on past the match, as in `a.mdx` or `a.md.bak`. */
const CONTINUES = /^(?:[\w/-]|\.\w)/u;
/** The match is the end of a longer path, as in `/docs/prompts/a.md`. */
const PATH_BEFORE = /[\w.-]$/u;
/** An origin right before the match, as in `https://acme.dev/prompts/a.md`. */
const ORIGIN_BEFORE = /[a-z][\w+.-]*:\/\/[^\s"'`()<>/]+$/iu;
/** How far back to look for an origin. */
const ORIGIN_LOOKBEHIND = 256;

/** Whether the match at `start`–`end` is a whole URL, not part of another path. */
const isWholeUrl = (source: string, start: number, end: number) => {
  if (CONTINUES.test(source.slice(end, end + 2))) {
    return false;
  }
  const before = source.slice(Math.max(0, start - ORIGIN_LOOKBEHIND), start);
  return !PATH_BEFORE.test(before) || ORIGIN_BEFORE.test(before);
};

/**
 * A matcher for the URLs Markdown prompts are served at, such as
 * `/prompts/setup.md`, or nothing when no prompt has a URL.
 */
const urlMatcher = (project: Project) => {
  const byUrl = new Map<string, string[]>();
  for (const { definition, markdown } of project.definitions) {
    if (markdown?.url) {
      byUrl.set(markdown.url, [
        ...(byUrl.get(markdown.url) ?? []),
        definition.id,
      ]);
    }
  }
  if (byUrl.size === 0) {
    return;
  }
  // Longest first, so a URL never stops a longer one from matching.
  const pattern = [...byUrl.keys()]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const regexp = new RegExp(pattern, "gu");
  return (source: string): string[] =>
    [...source.matchAll(regexp)].flatMap((match) =>
      isWholeUrl(source, match.index, match.index + match[0].length)
        ? (byUrl.get(match[0]) ?? [])
        : []
    );
};

/** The real path, because the resolver follows symlinks. */
const realPath = (file: string) => {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
};

/** content file → export name → the ids it holds, keyed by real path. */
const indexExports = (project: Project) => {
  const index = new Map<string, Map<string, string[]>>();
  for (const { definition, exportName, file } of project.definitions) {
    const absolute = realPath(path.resolve(project.config.root, file));
    const name = BASE_EXPORT.exec(exportName)?.[0] ?? exportName;
    const byName = index.get(absolute) ?? new Map<string, string[]>();
    byName.set(name, [...(byName.get(name) ?? []), definition.id]);
    index.set(absolute, byName);
  }
  return index;
};

/** The ids a file takes from a content file, by export name. */
const idsFor = (
  byName: ReadonlyMap<string, string[]>,
  names: readonly string[]
) =>
  names.flatMap((name) =>
    name === NAMESPACE ? [...byName.values()].flat() : (byName.get(name) ?? [])
  );

/**
 * Everything a JS or TS file imports: static imports (type-only ones don't
 * count), `require()` calls, and dynamic `import()`s. An MDX file's imports
 * are those in its ESM blocks.
 */
const importsOf = (file: string, source: string): ModuleUse[] => {
  const { module, program } =
    path.extname(file) === MDX
      ? parseSync(file, mdxEsm(source), { lang: "tsx" })
      : parseSync(file, source);
  const statements = module.staticImports.map((statement) => ({
    names: statement.entries
      .filter((entry) => !entry.isType)
      .map((entry) => {
        const kind = String(entry.importName.kind);
        if (kind === "NamespaceObject") {
          return NAMESPACE;
        }
        return kind === "Default" ? "default" : (entry.importName.name ?? "");
      }),
    request: statement.moduleRequest.value,
  }));
  return [...statements, ...moduleUses(program)];
};

/**
 * Finds which product files import each definition, by parsing the files the
 * config's `usage.include` globs match and resolving their imports with the
 * project's tsconfig paths. Type-only imports don't count, and `require()`
 * and `import()` do, as do imports in MDX. Markdown prompts with a `url` are
 * used by every file that contains their URL, Markdown and MDX included.
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
    const extension = path.extname(file);
    if (extension !== MDX && !EXTENSIONS.includes(extension)) {
      continue;
    }
    for (const use of importsOf(file, source)) {
      const target = resolver.resolveFileSync(file, use.request).path;
      const byName = target ? exportsByFile.get(target) : undefined;
      for (const id of byName ? idsFor(byName, use.names) : []) {
        record(id, file);
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
