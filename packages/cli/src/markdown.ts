import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { definePrompt } from "@copybook/core";
import type { PromptDefinition } from "@copybook/core";
import picomatch from "picomatch";
import { glob } from "tinyglobby";
import { parse } from "yaml";

import type { MarkdownMeta, MarkdownSource, ResolvedConfig } from "./config";
import { CopybookError } from "./errors";

const DEFAULT_INCLUDE = ["**/*.md"];
// The closing `---` must start a line, so YAML such as `title: a---` can't end it.
const FRONTMATTER =
  /^---[ \t]*\r?\n(?<yaml>(?:[\s\S]*?\r?\n)?)---[ \t]*(?:\r?\n|$)/u;
const LEADING_NEWLINES = /^(?:\r?\n)+/u;
const HEADING = /^#[ \t]+(?<title>.+?)(?:[ \t]+#+)?[ \t]*$/u;
// A backtick fence can't have backticks after it on its line.
const FENCE_OPEN = /^[ \t]*(?<fence>`{3,}(?=[^`]*$)|~{3,})/u;
const FENCE_CLOSE = /^[ \t]*(?<fence>`{3,}|~{3,})[ \t]*$/u;
const TRAILING_SLASHES = /\/+$/u;
const LIST_FIELDS = ["aliases", "owners", "placements", "tags"] as const;

/** A Markdown file loaded as a prompt. */
export interface MarkdownFile {
  definition: PromptDefinition;
  /** Relative to the config root, with forward slashes. */
  file: string;
  /** The file's raw text: the prompt's source and its snapshot. */
  text: string;
  /** Where the product serves it, such as `/prompts/setup.md`. */
  url?: string;
}

const toPosix = (file: string) => file.split(path.sep).join("/");

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The id of a file in a source, from its path in `dir`. */
export const markdownId = (source: MarkdownSource, fileInDir: string) => {
  const extension = path.extname(fileInDir);
  const stem =
    extension === "" ? fileInDir : fileInDir.slice(0, -extension.length);
  return `${source.idPrefix}.${stem.split("/").join(".")}`;
};

/** A source's directory, absolute. */
export const markdownDir = (config: ResolvedConfig, source: MarkdownSource) =>
  path.resolve(config.root, source.dir);

/** Whether a path in a source's `dir` is one of its prompts. */
export const matchesSource = (
  source: MarkdownSource,
  ignore: readonly string[]
): ((fileInDir: string) => boolean) => {
  // Like the loader's glob, which skips dotfiles.
  const included = picomatch(source.include ?? DEFAULT_INCLUDE);
  const excluded = picomatch([...ignore, ...(source.exclude ?? [])]);
  return (fileInDir) => included(fileInDir) && !excluded(fileInDir);
};

interface Frontmatter {
  body: string;
  data?: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const splitFrontmatter = (text: string, strict: boolean): Frontmatter => {
  const match = FRONTMATTER.exec(text);
  if (!match) {
    return { body: text };
  }
  const body = text.slice(match[0].length);
  try {
    const data: unknown = parse(match.groups?.yaml ?? "");
    return isRecord(data) ? { body, data } : { body };
  } catch (error) {
    if (strict) {
      throw new Error(
        `Its frontmatter isn't valid YAML: ${errorMessage(error)}`,
        {
          cause: error,
        }
      );
    }
    return { body };
  }
};

/** Whether `line` closes a fence that `open` started. */
const closesFence = (open: string, line: string) => {
  const fence = FENCE_CLOSE.exec(line)?.groups?.fence ?? "";
  return fence[0] === open[0] && fence.length >= open.length;
};

/**
 * The first `# ` heading outside code fences. A fence closes only with the
 * same character, at least as long, like in Markdown.
 */
const firstHeading = (markdown: string) => {
  let open: string | undefined;
  for (const raw of markdown.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (open !== undefined) {
      open = closesFence(open, line) ? undefined : open;
      continue;
    }
    open = FENCE_OPEN.exec(line)?.groups?.fence;
    const title = open ? undefined : HEADING.exec(line)?.groups?.title;
    if (title) {
      return title;
    }
  }
};

const stringField = (
  data: Readonly<Record<string, unknown>> | undefined,
  key: "description" | "title",
  strict: boolean
) => {
  const value = data?.[key];
  if (value === undefined || typeof value === "string") {
    return value;
  }
  if (strict) {
    throw new Error(`Its frontmatter "${key}" must be a string.`);
  }
};

const listField = (
  data: Readonly<Record<string, unknown>> | undefined,
  key: (typeof LIST_FIELDS)[number]
) => {
  const value = data?.[key];
  if (value === undefined) {
    return;
  }
  const isList =
    Array.isArray(value) && value.every((item) => typeof item === "string");
  if (!isList) {
    throw new Error(`Its frontmatter "${key}" must be a list of strings.`);
  }
  return value as string[];
};

/** Metadata from frontmatter: title and description, plus lists when stripped. */
const frontmatterMeta = (
  data: Readonly<Record<string, unknown>> | undefined,
  strip: boolean
): MarkdownMeta => {
  const meta: MarkdownMeta = {};
  const title = stringField(data, "title", strip);
  const description = stringField(data, "description", strip);
  if (title !== undefined) {
    meta.title = title;
  }
  if (description !== undefined) {
    meta.description = description;
  }
  if (strip) {
    for (const key of LIST_FIELDS) {
      const value = listField(data, key);
      if (value) {
        meta[key] = value;
      }
    }
  }
  return meta;
};

const buildFile = (
  config: ResolvedConfig,
  source: MarkdownSource,
  fileInDir: string,
  text: string
): MarkdownFile => {
  const strip = source.frontmatter === "strip";
  const { body, data } = splitFrontmatter(text, strip);
  const prompt = strip ? body.replace(LEADING_NEWLINES, "") : text;
  const meta: MarkdownMeta = {
    ...(source.owners ? { owners: source.owners } : {}),
    ...(source.placements ? { placements: source.placements } : {}),
    ...(source.tags ? { tags: source.tags } : {}),
    ...frontmatterMeta(data, strip),
    ...source.meta?.[fileInDir],
  };
  const title = meta.title ?? firstHeading(body);
  const file = toPosix(
    path.relative(
      config.root,
      path.join(markdownDir(config, source), fileInDir)
    )
  );
  const base = source.url?.replace(TRAILING_SLASHES, "");

  return {
    definition: definePrompt({
      ...meta,
      id: markdownId(source, fileInDir),
      markdown: prompt,
      ...(title ? { title } : {}),
    }),
    file,
    text,
    ...(base === undefined ? {} : { url: `${base}/${fileInDir}` }),
  };
};

const loadSource = async (
  config: ResolvedConfig,
  source: MarkdownSource,
  index: number,
  ignore: readonly string[]
): Promise<MarkdownFile[]> => {
  const dir = markdownDir(config, source);
  const label = `markdown[${index}]`;
  if (!existsSync(dir)) {
    throw new CopybookError(
      "CONFIG_INVALID",
      `${label}.dir "${source.dir}" doesn't exist.`
    );
  }
  const found = await glob(source.include ?? DEFAULT_INCLUDE, {
    cwd: dir,
    ignore: [...ignore, ...(source.exclude ?? [])],
  });
  const files = found.toSorted();
  const unknown = Object.keys(source.meta ?? {}).filter(
    (key) => !files.includes(key)
  );
  if (unknown.length > 0) {
    throw new CopybookError(
      "CONFIG_INVALID",
      `${label}.meta lists files that ${source.dir} doesn't have: ${unknown.join(", ")}.`
    );
  }

  const texts = await Promise.all(
    files.map((file) => readFile(path.join(dir, file), "utf-8"))
  );
  return files.map((fileInDir, fileIndex) => {
    try {
      return buildFile(config, source, fileInDir, texts[fileIndex] ?? "");
    } catch (error) {
      const file = toPosix(path.join(source.dir, fileInDir));
      throw new CopybookError(
        "LOAD_FAILED",
        `Couldn't load ${file}: ${errorMessage(error)}`
      );
    }
  });
};

/** Loads every Markdown file the config's `markdown` sources match. */
export const loadMarkdown = async (
  config: ResolvedConfig,
  ignore: readonly string[]
): Promise<MarkdownFile[]> => {
  const sources = await Promise.all(
    (config.markdown ?? []).map((source, index) =>
      loadSource(config, source, index, ignore)
    )
  );
  return sources.flat();
};
