import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { toBlocks } from "../src/blocks";
import type { Block, Inline } from "../src/blocks";
import {
  definePrompt,
  p,
  render,
  renderExample,
  toSegments,
  toText,
} from "../src/index";
import type { Rendered } from "../src/index";
import { getStarted, init } from "./fixtures";

const markdown = (source: string): Rendered =>
  render(definePrompt({ id: "test.prompt", markdown: source }));

const inlineText = (inlines: readonly Inline[]): string =>
  inlines
    .map((inline) =>
      "children" in inline ? inlineText(inline.children) : inline.text
    )
    .join("");

/** All the text a reader sees, without Markdown syntax. */
const blocksText = (blocks: readonly Block[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case "list": {
          return block.items
            .map((item, index) => {
              const number = block.ordered ? (block.start ?? 1) + index : "";
              return `${number} ${blocksText(item.children)}`;
            })
            .join(" ");
        }
        case "blockquote": {
          return blocksText(block.children);
        }
        case "thematicBreak": {
          return "";
        }
        case "code": {
          return `${block.lang ?? ""} ${inlineText(block.children)}`;
        }
        default: {
          return inlineText(block.children);
        }
      }
    })
    .join(" ");

const WORD = /[\p{L}\p{N}]+/gu;

const listItems = (block: Block | undefined) =>
  block?.type === "list" ? block.items : [];

describe(toBlocks, () => {
  it("reads a numbered list after a paragraph", () => {
    const [intro, list, ...rest] = toBlocks(renderExample(getStarted));

    expect(intro).toStrictEqual({
      children: [{ text: "Set up this app on Acme.", type: "text" }],
      type: "paragraph",
    });
    expect(list).toMatchObject({ ordered: true, start: 1, type: "list" });
    expect(listItems(list)).toHaveLength(3);
    expect(rest).toStrictEqual([]);
  });

  it("reads inline and standalone commands in list items", () => {
    const [, list] = toBlocks(renderExample(getStarted));
    const [first, second, third] = listItems(list);

    expect(first?.children).toStrictEqual([
      {
        children: [
          {
            children: [{ text: "npm i -g acme@latest", type: "text" }],
            command: true,
            id: "acme.install",
            type: "inlineCode",
          },
          { text: ". If that fails, use ", type: "text" },
          {
            children: [{ text: "npx acme@latest", type: "text" }],
            type: "inlineCode",
          },
          { text: ".", type: "text" },
        ],
        type: "paragraph",
      },
    ]);
    expect(second?.children).toStrictEqual([
      {
        children: [{ text: "In the project root:", type: "text" }],
        type: "paragraph",
      },
      {
        children: [
          { text: "acme init -y --org-id ", type: "text" },
          { name: "orgId", text: "org-example", type: "param" },
          { text: " --project-id ", type: "text" },
          { name: "projectId", text: "proj-example", type: "param" },
          { text: " --branch ", type: "text" },
          { name: "branch", text: "production", type: "param" },
        ],
        id: "acme.init",
        type: "command",
      },
    ]);
    expect(third?.children[1]).toMatchObject({
      id: "acme.gateway.chat",
      lang: "ts",
      type: "code",
    });
  });

  it("keeps a code block's params and drops its list indentation", () => {
    const [, list] = toBlocks(renderExample(getStarted));
    const code = listItems(list)[2]?.children[1];
    const children = code?.type === "code" ? code.children : [];
    const text = inlineText(children);

    expect(children).toContainEqual({
      name: "model",
      text: "claude-haiku-5-5",
      type: "param",
    });
    expect(text).toMatch(/^import \{ generateText \}/u);
    expect(text).toContain('\n  model: acme("');
    expect(text).not.toMatch(/^ {3}/mu);
  });

  it("reads headings and bash fences from a Markdown prompt", () => {
    const source = readFileSync(
      path.join(
        import.meta.dirname,
        "../../../examples/acme/public/prompts/agent-setup.md"
      ),
      "utf-8"
    );
    const blocks = toBlocks(markdown(source));

    expect(blocks[0]).toMatchObject({ lang: "yaml", type: "code" });
    expect(
      blocks
        .filter((block) => block.type === "heading")
        .map((block) => [block.level, inlineText(block.children)])
    ).toStrictEqual([
      [2, "Install the Acme CLI"],
      [2, "Sign in"],
      [2, "Add Acme's agent skills"],
    ]);
    expect(
      blocks
        .filter((block) => block.type === "code" && block.lang === "bash")
        .map((block) => inlineText(block.type === "code" ? block.children : []))
    ).toStrictEqual([
      "acme --version",
      "npm install -g acme@latest",
      "acme login",
      "acme skills add --yes",
    ]);
  });

  it("nests lists and keeps fences inside list items", () => {
    const blocks = toBlocks(
      markdown(
        [
          "- One",
          "  - One a",
          "  - One b",
          "- Two",
          "",
          "  ```sh",
          "  acme init",
          "  ```",
          "",
          "3) Three",
        ].join("\n")
      )
    );

    expect(blocks).toStrictEqual([
      {
        items: [
          {
            children: [
              { children: [{ text: "One", type: "text" }], type: "paragraph" },
              {
                items: [
                  {
                    children: [
                      {
                        children: [{ text: "One a", type: "text" }],
                        type: "paragraph",
                      },
                    ],
                  },
                  {
                    children: [
                      {
                        children: [{ text: "One b", type: "text" }],
                        type: "paragraph",
                      },
                    ],
                  },
                ],
                ordered: false,
                type: "list",
              },
            ],
          },
          {
            children: [
              { children: [{ text: "Two", type: "text" }], type: "paragraph" },
              {
                children: [{ text: "acme init", type: "text" }],
                lang: "sh",
                type: "code",
              },
            ],
          },
        ],
        ordered: false,
        type: "list",
      },
      {
        items: [
          {
            children: [
              {
                children: [{ text: "Three", type: "text" }],
                type: "paragraph",
              },
            ],
          },
        ],
        ordered: true,
        start: 3,
        type: "list",
      },
    ]);
  });

  it("reads emphasis, links, and bare URLs, and drops unsafe links", () => {
    const [paragraph] = toBlocks(
      markdown(
        "**Read** the _[docs](https://acme.dev/docs)_ at https://acme.dev/start. [x](javascript:alert(1)) snake_case_name"
      )
    );

    expect(paragraph).toStrictEqual({
      children: [
        { children: [{ text: "Read", type: "text" }], type: "strong" },
        { text: " the ", type: "text" },
        {
          children: [
            {
              children: [{ text: "docs", type: "text" }],
              href: "https://acme.dev/docs",
              type: "link",
            },
          ],
          type: "emphasis",
        },
        { text: " at ", type: "text" },
        {
          children: [{ text: "https://acme.dev/start", type: "text" }],
          href: "https://acme.dev/start",
          type: "link",
        },
        {
          text: ". [x](javascript:alert(1)) snake_case_name",
          type: "text",
        },
      ],
      type: "paragraph",
    });
  });

  it("marks secrets and their placeholders", () => {
    const prompt = definePrompt({
      id: "test.secret",
      params: {
        token: p.secret({ env: "ACME_TOKEN", placeholder: "<your-token>" }),
      },
      template: (t, { token }) => t`Use \`${token}\` to sign in.`,
    });

    const [placeholder] = toBlocks(render(prompt, {}));
    const [real] = toBlocks(render(prompt, { token: "tok_123" }));

    expect(placeholder).toMatchObject({
      children: [
        { text: "Use ", type: "text" },
        {
          children: [
            {
              name: "token",
              placeholder: true,
              secret: true,
              text: "<your-token>",
              type: "param",
            },
          ],
          type: "inlineCode",
        },
        { text: " to sign in.", type: "text" },
      ],
    });
    expect(real).toMatchObject({
      children: [
        {},
        {
          children: [
            { name: "token", secret: true, text: "tok_123", type: "param" },
          ],
        },
        {},
      ],
    });
  });

  it("never reads Markdown inside params or commands", () => {
    const prompt = definePrompt({
      id: "test.literal",
      params: { name: p.string() },
      template: (t, { name }) =>
        t`Hi *${name}* ${t.cmd(init, { orgId: "**o**", projectId: "_p_" })}`,
    });
    const [paragraph] = toBlocks(render(prompt, { name: "**bold**" }));

    expect(
      paragraph?.type === "paragraph" ? paragraph.children : []
    ).toMatchObject([
      { text: "Hi ", type: "text" },
      {
        children: [{ name: "name", text: "**bold**", type: "param" }],
        type: "emphasis",
      },
      { text: " ", type: "text" },
      { command: true, id: "acme.init", type: "inlineCode" },
    ]);
  });

  it("keeps Markdown it doesn't know as paragraph text", () => {
    const source = "| a | b |\n| - | - |\n| 1 | 2 |\n\n<div>hi</div>";

    expect(toBlocks(markdown(source))).toStrictEqual([
      {
        children: [{ text: "| a | b |\n| - | - |\n| 1 | 2 |", type: "text" }],
        type: "paragraph",
      },
      {
        children: [{ text: "<div>hi</div>", type: "text" }],
        type: "paragraph",
      },
    ]);
  });

  it("reads blockquotes, breaks, setext headings, and unclosed fences", () => {
    const blocks = toBlocks(
      markdown("Title\n=====\n\n> Quoted\n\n---\n\n```bash\nacme init")
    );

    expect(blocks).toStrictEqual([
      {
        children: [{ text: "Title", type: "text" }],
        level: 1,
        type: "heading",
      },
      {
        children: [
          { children: [{ text: "Quoted", type: "text" }], type: "paragraph" },
        ],
        type: "blockquote",
      },
      { type: "thematicBreak" },
      {
        children: [{ text: "acme init", type: "text" }],
        lang: "bash",
        type: "code",
      },
    ]);
  });

  it.each([
    ["the get-started prompt", renderExample(getStarted)],
    [
      "a Markdown prompt",
      markdown(
        "# Connect\n\n1. Install:\n\n    ```bash\n    npm i pg\n    ```\n\n2. Read *the* `docs`.\n"
      ),
    ],
  ])("shows every word and param of %s", (_name, rendered) => {
    const shown = blocksText(toBlocks(rendered));

    for (const word of toText(rendered).match(WORD) ?? []) {
      expect(shown).toContain(word);
    }
    const params = toSegments(rendered).filter(
      (segment) => segment.type === "param"
    );
    for (const param of params) {
      expect(shown).toContain(param.text);
    }
  });
});
