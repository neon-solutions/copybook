import { describe, expect, it } from "vitest";

import {
  DEFINITION,
  defineCollection,
  defineCommand,
  defineSnippet,
  isCollection,
  isDefinition,
  renderExample,
  toText,
  variantKey,
} from "../src/index";
import { login } from "./fixtures";

describe("define", () => {
  it("brands and freezes definitions", () => {
    expect(isDefinition(login)).toBeTruthy();
    expect(login[DEFINITION]).toBeTruthy();
    expect(Object.isFrozen(login)).toBeTruthy();
    expect(login.verify).toStrictEqual({
      skip: "interactive: opens a browser",
    });
  });

  it("rejects ids that aren't lowercase and dotted", () => {
    expect(() => defineCommand({ id: "Bad Id", template: () => "" })).toThrow(
      'Invalid definition id "Bad Id".'
    );
  });

  it("rejects variants with unknown options or duplicate keys", () => {
    expect(() =>
      defineSnippet({
        dimensions: { framework: { ts: "TypeScript" } },
        id: "bad",
        // @ts-expect-error "go" isn't a framework option
        variants: [{ code: "", when: { framework: "go" } }],
      })
    ).toThrow('Snippet "bad" has a variant with unknown framework "go".');

    expect(() =>
      defineSnippet({
        dimensions: { framework: { ts: "TypeScript" } },
        id: "dupe",
        variants: [
          { code: "a", when: { framework: "ts" } },
          { code: "b", when: { framework: "ts" } },
        ],
      })
    ).toThrow('Snippet "dupe" has two variants for "framework=ts".');
  });

  it("orders variant keys by dimension declaration", () => {
    expect(
      variantKey(
        { framework: {}, setup: {} },
        { framework: "ts", setup: "env" }
      )
    ).toBe("framework=ts;setup=env");
  });
});

describe(defineCollection, () => {
  const models = [
    { name: "Claude Haiku 5.5", slug: "claude-haiku-5-5" },
    { name: "GPT-5 mini", slug: "gpt-5-mini" },
  ];

  it("builds one definition per item with ids from keys", () => {
    const collection = defineCollection({
      build: (model, { id }) =>
        defineCommand({ id, template: () => `echo ${model.name}` }),
      idPrefix: "gateway.model",
      items: models,
      key: (model) => model.slug,
    });

    expect(isCollection(collection)).toBeTruthy();
    expect([...collection.definitions.values()].map((d) => d.id)).toStrictEqual(
      ["gateway.model.claude-haiku-5-5", "gateway.model.gpt-5-mini"]
    );
    expect(toText(renderExample(collection.get("gpt-5-mini")))).toBe(
      "echo GPT-5 mini"
    );
  });

  it("rejects duplicate keys and ids that ignore the given id", () => {
    expect(() =>
      defineCollection({
        build: (_model, { id }) => defineCommand({ id, template: () => "" }),
        idPrefix: "dupe",
        items: [...models, models[0]],
        key: (model) => model?.slug ?? "",
      })
    ).toThrow('Collection "dupe" has duplicate key "claude-haiku-5-5".');

    expect(() =>
      defineCollection({
        build: () => defineCommand({ id: "other", template: () => "" }),
        idPrefix: "wrong",
        items: models,
        key: (model) => model.slug,
      })
    ).toThrow('Collection "wrong" built "other" for key "claude-haiku-5-5".');
  });
});
