import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import { CopybookError } from "./errors";

interface BundleOptions {
  /** The entry module's source. */
  contents: string;
  /** Names the output file in the cache. */
  name: string;
  root: string;
  stubs?: readonly string[];
  tsconfig?: string;
}

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const stubPlugin = (stubs: readonly string[]): Plugin => ({
  name: "copybook-stubs",
  setup: (pluginBuild) => {
    if (stubs.length === 0) {
      return;
    }
    // esbuild runs filters in Go, which has no `u` flag.
    // oxlint-disable-next-line require-unicode-regexp
    const filter = new RegExp(`^(${stubs.map(escapeRegExp).join("|")})$`);
    pluginBuild.onResolve({ filter }, (args) => ({
      namespace: "copybook-stub",
      path: args.path,
    }));
    pluginBuild.onLoad(
      // oxlint-disable-next-line require-unicode-regexp -- esbuild filters are Go regexes
      { filter: /.*/, namespace: "copybook-stub" },
      () => ({
        contents: "export default {};",
        loader: "js",
      })
    );
  },
});

/** Dependencies stay external and resolve from the project's node_modules. */
const bundleAndImportUnchecked = async ({
  contents,
  name,
  root,
  stubs = [],
  tsconfig,
}: BundleOptions): Promise<Record<string, unknown>> => {
  const tsconfigPath = path.resolve(root, tsconfig ?? "tsconfig.json");
  const result = await build({
    bundle: true,
    format: "esm",
    loader: { ".css": "empty", ".scss": "empty", ".svg": "empty" },
    logLevel: "silent",
    packages: "external",
    platform: "node",
    plugins: [stubPlugin(stubs)],
    sourcemap: "inline",
    stdin: {
      contents,
      loader: "ts",
      resolveDir: root,
      sourcefile: `${name}.ts`,
    },
    target: "node22",
    write: false,
    ...(existsSync(tsconfigPath) ? { tsconfig: tsconfigPath } : {}),
  });

  const [output] = result.outputFiles;
  if (!output) {
    throw new Error("esbuild produced no output.");
  }
  // The bundle lives inside the project so bare imports resolve from its
  // node_modules. The hash keeps Node's module cache from serving old code.
  const hash = createHash("sha256").update(output.contents).digest("hex");
  const cacheDir = path.join(root, "node_modules", ".cache", "copybook");
  const file = path.join(cacheDir, `${name}-${hash.slice(0, 12)}.mjs`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, output.contents);
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
};

/**
 * Bundles TypeScript sources with esbuild, so tsconfig path aliases and
 * extensionless imports resolve, then imports the result. A syntax error or
 * a throw in the project's code becomes a LOAD_FAILED error.
 */
export const bundleAndImport = async (
  options: BundleOptions
): Promise<Record<string, unknown>> => {
  try {
    return await bundleAndImportUnchecked(options);
  } catch (error) {
    if (error instanceof CopybookError) {
      throw error;
    }
    throw new CopybookError(
      "LOAD_FAILED",
      `Couldn't load the ${options.name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
