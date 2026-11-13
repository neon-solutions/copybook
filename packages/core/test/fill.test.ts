import { describe, expect, it } from "vitest";

import { fillParams, listParams } from "../src/fill";
import {
  defineCommand,
  definePrompt,
  p,
  render,
  renderExample,
  toSegments,
  toText,
} from "../src/index";

const login = defineCommand({
  id: "test.login",
  params: { orgId: p.string().example("org-example") },
  template: (t, { orgId }) => t`acme login --org ${orgId}`,
});

const prompt = definePrompt({
  id: "test.fill",
  params: {
    orgId: p.string().example("org-example"),
    token: p.secret({ placeholder: "<your-token>" }),
  },
  template: (t, params) => t`
    Use org ${params.orgId} and token ${params.token}.
    Then run ${t.cmd(login, { orgId: params.orgId })}.
  `,
});

describe(listParams, () => {
  it("lists each param once, in order, with its first value", () => {
    expect(listParams(renderExample(prompt))).toStrictEqual([
      { name: "orgId", value: "org-example" },
      { name: "token", placeholder: true, secret: true, value: "<your-token>" },
    ]);
  });
});

describe(fillParams, () => {
  it("replaces values by name, in embedded commands too", () => {
    const filled = fillParams(renderExample(prompt), { orgId: "org-real" });

    expect(toText(filled)).toBe(
      "Use org org-real and token <your-token>.\nThen run acme login --org org-real."
    );
  });

  it("matches what render gives with the same values", () => {
    const filled = fillParams(renderExample(prompt), {
      orgId: "org-real",
      token: "sk-123",
    });

    expect(filled).toStrictEqual(
      render(prompt, { orgId: "org-real", token: "sk-123" })
    );
  });

  it("turns a filled placeholder into a real secret", () => {
    const filled = fillParams(renderExample(prompt), { token: "sk-123" });
    const token = toSegments(filled).find(({ name }) => name === "token");

    expect(token).toMatchObject({ secret: true, text: "sk-123" });
    expect(token).not.toHaveProperty("placeholder");
  });

  it("ignores empty values and unknown names", () => {
    const rendered = renderExample(prompt);

    expect(fillParams(rendered, { orgId: "", other: "x" })).toStrictEqual(
      rendered
    );
  });
});
