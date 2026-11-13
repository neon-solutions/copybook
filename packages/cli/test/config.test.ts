import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfigSource } from "../src/config";

const file = path.join(
  import.meta.dirname,
  "fixtures/basic/copybook.config.ts"
);

const load = (config: string) =>
  loadConfigSource(`export default ${config};`, file);

describe(loadConfigSource, () => {
  it("accepts well-formed list fields", async () => {
    const config = await load(
      `{ content: ["**/*.ts"], exclude: ["x.ts"], usage: { include: ["app/**/*.tsx"] } }`
    );

    expect(config.usage).toStrictEqual({ include: ["app/**/*.tsx"] });
  });

  it.each([
    [
      "usage as an array",
      `{ content: ["a.ts"], usage: ["app/**/*.tsx"] }`,
      "`usage` must be an object like { include: [...globs], exclude?: [...globs] }.",
    ],
    [
      "usage without include",
      `{ content: ["a.ts"], usage: { exclude: ["x"] } }`,
      "`usage` must be an object like { include: [...globs], exclude?: [...globs] }.",
    ],
    [
      "a string where a list goes",
      `{ content: ["a.ts"], exclude: "x.ts" }`,
      "`exclude` must be an array of strings.",
    ],
    [
      "a non-string glob",
      `{ content: ["a.ts", 1] }`,
      "`content` must be an array of strings.",
    ],
    [
      "markdown as an object",
      `{ content: ["a.ts"], markdown: {} }`,
      "`markdown` must be an array of { dir, idPrefix } sources.",
    ],
    [
      "a Markdown include string",
      `{ markdown: [{ dir: "p", idPrefix: "p", include: "*.md" }] }`,
      "`markdown[0].include` must be an array of strings.",
    ],
  ])("rejects %s as CONFIG_INVALID", async (_name, config, problem) => {
    await expect(load(config)).rejects.toMatchObject({
      code: "CONFIG_INVALID",
      message: `copybook.config.ts: ${problem}`,
    });
  });
});
