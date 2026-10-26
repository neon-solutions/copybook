import { describe, expect, it } from "vitest";

import {
  collectCommands,
  collectEmbeds,
  defineCommand,
  definePrompt,
  defineSnippet,
  p,
  render,
  renderExample,
  toSegments,
  toText,
} from "../src/index";
import { client, getStarted, init } from "./fixtures";

describe(render, () => {
  it("renders params as param nodes", () => {
    const rendered = render(init, { orgId: "org-1", projectId: "proj-1" });

    expect(rendered).toStrictEqual({
      id: "acme.init",
      kind: "command",
      nodes: [
        { type: "text", value: "acme init -y --org-id " },
        { name: "orgId", type: "param", value: "org-1" },
        { type: "text", value: " --project-id " },
        { name: "projectId", type: "param", value: "proj-1" },
        { type: "text", value: " --branch " },
        { name: "branch", type: "param", value: "production" },
      ],
    });
  });

  it("throws when a required param is missing", () => {
    // @ts-expect-error projectId is required
    expect(() => render(init, { orgId: "org-1" })).toThrow(
      'Missing required param "projectId" for "acme.init".'
    );
  });

  it("accepts a plain string from template", () => {
    const hello = defineCommand({ id: "hello", template: () => "echo hi" });

    expect(toText(render(hello))).toBe("echo hi");
  });

  it("skips null, undefined, and booleans, and flattens arrays", () => {
    const list = defineCommand({
      id: "list",
      params: { verbose: p.boolean().default(false) },
      template: (t, { verbose }) =>
        t`ls${verbose && " -la"}${null}${undefined}${[" a", [" b"]]}`,
    });

    expect(toText(render(list))).toBe("ls a b");
    expect(toText(render(list, { verbose: true }))).toBe("ls -la a b");
  });

  it("dedents templates and drops the blank first and last lines", () => {
    const prompt = definePrompt({
      id: "dedent",
      template: (t) => t`
        First line.
          Indented line.

        Last line.
      `,
    });

    expect(toText(render(prompt))).toBe(
      "First line.\n  Indented line.\n\nLast line."
    );
  });
});

describe("embedding", () => {
  it("renders the Acme getting-started prompt", () => {
    const text = toText(
      render(getStarted, { orgId: "org-1", projectId: "proj-1" })
    );

    expect(text).toBe(
      [
        "Set up this app on Acme.",
        "1. npm i -g acme@latest. If that fails, use `npx acme@latest`.",
        "2. In the project root:",
        "   acme init -y --org-id org-1 --project-id proj-1 --branch production",
        "3. Call the gateway:",
        "   ```ts",
        '   import { generateText } from "ai";',
        "",
        "   const { text } = await generateText({",
        '     model: acme("claude-haiku-5-5"),',
        '     prompt: "Explain serverless Postgres.",',
        "   });",
        "   ```",
      ].join("\n")
    );
  });

  it("keeps embedded definition ids in the tree", () => {
    const rendered = renderExample(getStarted);

    expect(collectEmbeds(rendered)).toStrictEqual([
      "acme.install",
      "acme.init",
      "acme.gateway.chat",
    ]);
    expect(collectCommands(rendered)).toStrictEqual([
      { id: "acme.install", text: "npm i -g acme@latest" },
      {
        id: "acme.init",
        text: "acme init -y --org-id org-example --project-id proj-example --branch production",
      },
    ]);
  });

  it("supports literal commands and code blocks", () => {
    const prompt = definePrompt({
      id: "literal",
      template: (t) =>
        t`Run ${t.cmd("npm test")} and add:${t.code("json", '{\n  "a": 1\n}')}`,
    });

    expect(toText(render(prompt))).toBe(
      'Run npm test and add:\n```json\n{\n  "a": 1\n}\n```'
    );
    expect(toText(render(prompt), { format: "plain" })).toBe(
      'Run npm test and add:{\n  "a": 1\n}'
    );
  });

  it("includes other prompts", () => {
    const footer = definePrompt({
      id: "shared.report",
      template: (t) => t`Report what changed.`,
    });
    const prompt = definePrompt({
      id: "with-footer",
      template: (t) => t`
        Do the thing.
        ${t.include(footer)}
      `,
    });

    expect(toText(render(prompt))).toBe("Do the thing.\nReport what changed.");
    expect(collectEmbeds(render(prompt))).toStrictEqual(["shared.report"]);
  });
});

describe("snippets", () => {
  it("selects variants by dimensions or key", () => {
    const byDimension = renderExample(client, {
      variant: { framework: "curl" },
    });
    const byKey = renderExample(client, { variant: "framework=curl" });

    expect(byDimension).toStrictEqual(byKey);
    expect(byKey).toMatchObject({ lang: "bash", variant: "framework=curl" });
  });

  it("uses the first variant by default", () => {
    expect(renderExample(client).variant).toBe("framework=ai-sdk");
  });

  it("throws for a variant that doesn't exist", () => {
    expect(() =>
      renderExample(client, { variant: { framework: "python" } })
    ).toThrow(
      'Snippet "acme.gateway.chat" has no variant {"framework":"python"}.'
    );
  });

  it("renders missing secrets as placeholders", () => {
    const segments = toSegments(
      renderExample(client, { variant: { framework: "curl" } })
    );

    expect(segments).toContainEqual({
      name: "token",
      placeholder: true,
      secret: true,
      text: "<your-token>",
      type: "param",
    });
  });

  it("marks real secrets without the placeholder flag", () => {
    const rendered = render(
      client,
      { model: "gpt-5-mini", token: "sk-123" },
      { variant: { framework: "curl" } }
    );

    expect(toSegments(rendered)).toContainEqual({
      name: "token",
      secret: true,
      text: "sk-123",
      type: "param",
    });
  });

  it("supports single snippets with static code", () => {
    const env = defineSnippet({
      code: "ACME_URL=https://acme.dev",
      id: "acme.env",
      lang: "dotenv",
    });

    expect(render(env)).toStrictEqual({
      id: "acme.env",
      kind: "snippet",
      lang: "dotenv",
      nodes: [{ type: "text", value: "ACME_URL=https://acme.dev" }],
    });
  });
});

describe(renderExample, () => {
  it("explains how to fix a param without an example", () => {
    const command = defineCommand({
      id: "needs-example",
      params: { name: p.string() },
      template: (t, { name }) => t`echo ${name}`,
    });

    expect(() => renderExample(command)).toThrow(
      'Param "name" of "needs-example" needs an .example() or .default() to render a preview.'
    );
  });

  it("lets callers fill in values", () => {
    const rendered = renderExample(init, { values: { orgId: "org-real" } });

    expect(toText(rendered)).toBe(
      "acme init -y --org-id org-real --project-id proj-example --branch production"
    );
  });
});
