import { describe, expect, it } from "vitest";

import { p } from "../src/index";

describe("param builders", () => {
  it("returns a new param from every builder method", () => {
    const base = p.string();
    const withExample = base.example("a");

    expect(withExample).not.toBe(base);
    expect(base.state.example).toBeUndefined();
    expect(withExample.state.example).toBe("a");
  });

  it("marks params with defaults as optional", () => {
    const param = p.string().default("main");

    expect(param.state).toMatchObject({ default: "main", optional: true });
  });

  it("makes secrets optional with a placeholder", () => {
    const param = p.secret({ env: "TOKEN", placeholder: "<token>" });

    expect(param.state).toMatchObject({
      env: "TOKEN",
      kind: "secret",
      optional: true,
      placeholder: "<token>",
    });
  });

  it("keeps enum values", () => {
    expect(p.enum(["a", "b"]).state.values).toStrictEqual(["a", "b"]);
  });

  it("serializes schema params by vendor", () => {
    const schema = { "~standard": { vendor: "zod", version: 1 as const } };
    const json = p.schema(schema).describe("A thing").toJSON();

    expect(json).toStrictEqual({
      description: "A thing",
      kind: "schema",
      optional: false,
      vendor: "zod",
    });
  });
});
