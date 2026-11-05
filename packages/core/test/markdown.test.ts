import { describe, expect, it } from "vitest";

import {
  collectCommands,
  definePrompt,
  isDefinition,
  render,
  renderExample,
  toSegments,
  toText,
} from "../src/index";
import { parseMarkdown } from "../src/markdown";

const roundTrip = (markdown: string) =>
  toText({ id: "", kind: "prompt", nodes: parseMarkdown(markdown) });

const LIST_PROMPT = [
  "# Connect to Acme",
  "",
  "1. Install a driver:",
  "",
  "    ```bash",
  "    npm install @acme/serverless",
  "",
  "    # or",
  "    npm install pg",
  "    ```",
  "",
  "2. Create `src/db.ts`:",
  "",
  '```typescript title="src/db.ts"',
  "export const db = connect(process.env.DATABASE_URL);",
  "```",
  "",
].join("\n");

describe(parseMarkdown, () => {
  it("turns fenced blocks into code nodes with lang and meta", () => {
    expect(parseMarkdown(LIST_PROMPT)).toStrictEqual([
      {
        type: "text",
        value: "# Connect to Acme\n\n1. Install a driver:\n\n    ",
      },
      {
        children: [
          {
            type: "text",
            value: "npm install @acme/serverless\n\n# or\nnpm install pg",
          },
        ],
        lang: "bash",
        type: "code",
      },
      { type: "text", value: "\n\n2. Create `src/db.ts`:\n\n" },
      {
        children: [
          {
            type: "text",
            value: "export const db = connect(process.env.DATABASE_URL);",
          },
        ],
        lang: "typescript",
        meta: 'title="src/db.ts"',
        type: "code",
      },
      { type: "text", value: "\n" },
    ]);
  });

  it.each([
    ["no fences", "Set me up for Acme.\n\nRun `acme init`.\n"],
    ["a list fence", LIST_PROMPT],
    ["frontmatter", "---\ntitle: Setup\n---\n\n```sh\nacme login\n```\n"],
    ["a fence without a lang", "```\nplain\n```"],
    ["tilde fences", "~~~bash\nacme init\n~~~\n"],
    ["longer fences", "````md\n```bash\nacme\n```\n````\n"],
    ["an empty fence", "```bash\n```\n"],
    ["an unclosed fence", "Intro\n\n```bash\nacme init\n"],
    ["a blank line with spaces", "  ```bash\n  a\n  \n  b\n  ```\n"],
    ["a line indented less than its fence", "  ```bash\n a\n  ```\n"],
    ["a closing fence with trailing spaces", "```bash\na\n```  \n"],
    ["two spaces before meta", "```ts  title=x\na\n```\n"],
    ["inline code fences", "Use ```inline``` here.\n"],
    ["a blockquoted fence", "> ```bash\n> acme\n> ```\n"],
    ["CRLF line endings", "Intro\r\n\r\n```bash\r\nacme init\r\n```\r\n"],
    ["back-to-back fences", "```a\n1\n```\n```b\n2\n```"],
    ["an empty string", ""],
  ])("renders %s back to the exact source", (_name, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("keeps blocks it can't reproduce as text", () => {
    for (const markdown of [
      "~~~bash\nacme init\n~~~",
      "```bash\n```",
      "  ```bash\n  a\n  \n  b\n  ```",
      "```bash\na\n```  ",
    ]) {
      expect(parseMarkdown(markdown)).toStrictEqual([
        { type: "text", value: markdown },
      ]);
    }
  });

  it("doesn't open a fence inside a fence it kept as text", () => {
    const nodes = parseMarkdown("````md\n```bash\nacme\n```\n````");

    expect(nodes.some((node) => node.type === "code")).toBeFalsy();
  });
});

describe("definePrompt with markdown", () => {
  const prompt = definePrompt({
    id: "acme.prompts.connect",
    markdown: LIST_PROMPT,
    title: "Connect to Acme",
  });

  it("renders the Markdown exactly as written", () => {
    expect(isDefinition(prompt)).toBeTruthy();
    expect(prompt.markdown).toBe(LIST_PROMPT);
    expect(prompt.params).toStrictEqual({});
    expect(toText(render(prompt))).toBe(LIST_PROMPT);
    expect(toText(renderExample(prompt))).toBe(LIST_PROMPT);
  });

  it("returns new nodes on every render", () => {
    expect(render(prompt).nodes).not.toBe(render(prompt).nodes);
    expect(render(prompt)).toStrictEqual(render(prompt));
  });

  it("gives fences their own segments and plain text without them", () => {
    const fences = toSegments(render(prompt))
      .filter((segment) => segment.type === "fence")
      .map((segment) => segment.text);

    expect(fences).toStrictEqual([
      "```bash\n    ",
      "\n    ```",
      '```typescript title="src/db.ts"\n',
      "\n```",
    ]);
    expect(toText(render(prompt), { format: "plain" })).not.toContain("```");
  });

  it("has no embedded commands of its own", () => {
    expect(collectCommands(render(prompt))).toStrictEqual([]);
  });

  it("types reject markdown together with a template or params", () => {
    expect(() =>
      // @ts-expect-error a prompt has either markdown or a template
      definePrompt({ id: "both", markdown: "a", template: () => "b" })
    ).not.toThrow();
    expect(() =>
      // @ts-expect-error Markdown prompts have no params
      definePrompt({ id: "params", markdown: "a", params: {} })
    ).not.toThrow();
  });
});
