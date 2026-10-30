import path from "node:path";

import { defineCommand } from "@copybook/core";
import { describe, expect, it } from "vitest";

import { collectDefinitions, loadProject } from "../src/load";

const fixture = path.join(import.meta.dirname, "fixtures/basic");

describe(loadProject, () => {
  it("finds definitions through path aliases, stubs, and collections", async () => {
    const project = await loadProject(fixture);

    expect(
      project.definitions.map(({ definition, exportName, file }) => [
        definition.id,
        file,
        exportName,
      ])
    ).toStrictEqual([
      ["fixture.greet", "src/prompts.ts", "greet"],
      ["fixture.hello", "src/commands.ts", "hello"],
      ["fixture.lang.python", "src/prompts.ts", "languages[python]"],
      ["fixture.lang.ruby", "src/prompts.ts", "languages[ruby]"],
      ["fixture.readme", "src/prompts.ts", "readme"],
    ]);
  });
});

describe(collectDefinitions, () => {
  const a = defineCommand({ id: "same", template: () => "a" });
  const b = defineCommand({ id: "same", template: () => "b" });

  it("rejects two definitions with one id", () => {
    expect(() =>
      collectDefinitions({ "one.ts": { a }, "two.ts": { b } })
    ).toThrow('Duplicate id "same" in one.ts#a and two.ts#b.');
  });

  it("looks one level into arrays and objects", () => {
    const c = defineCommand({ id: "other", template: () => "c" });
    const found = collectDefinitions({
      "defs.ts": { grouped: { first: a }, list: [c] },
    });

    expect(found.map((item) => item.exportName)).toStrictEqual([
      "list[0]",
      "grouped.first",
    ]);
  });
});
