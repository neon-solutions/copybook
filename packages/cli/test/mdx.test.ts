import { describe, expect, it } from "vitest";

import { mdxEsm } from "../src/mdx";

const mdx = (...lines: string[]) => lines.join("\n");

describe(mdxEsm, () => {
  it("keeps import and export blocks, across lines", () => {
    const source = mdx(
      "import { a } from './a';",
      "import {",
      "  b,",
      "} from './b';",
      "",
      "# Title",
      "",
      "export const meta = { c: 1 };"
    );

    expect(mdxEsm(source)).toBe(
      mdx(
        "import { a } from './a';",
        "import {",
        "  b,",
        "} from './b';",
        "export const meta = { c: 1 };"
      )
    );
  });

  it("skips frontmatter and code fences", () => {
    const source = mdx(
      "---",
      "title: import x from 'y'",
      "---",
      "",
      "```ts",
      "import { fenced } from './fenced';",
      "```",
      "",
      "~~~~",
      "```",
      "import { tilde } from './tilde';",
      "~~~~",
      "import { real } from './real';"
    );

    expect(mdxEsm(source)).toBe("import { real } from './real';");
  });

  it("skips import mid-paragraph and in indented lines", () => {
    const source = mdx(
      "Some prose that wraps and then says",
      "import that is not code.",
      "",
      "    import { indented } from './indented';"
    );

    expect(mdxEsm(source)).toBe("");
  });
});
