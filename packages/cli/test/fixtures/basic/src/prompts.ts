import { defineCollection, definePrompt, defineSnippet } from "@copybook/core";

// Resolved through the tsconfig path alias.
import { hello } from "@/commands";

export const greet = definePrompt({
  id: "fixture.greet",
  template: (t) => t`
    Run this:
    ${t.cmd(hello, { name: "agent" })}
  `,
});

// Re-exporting the same definition must not count twice.
export { hello as helloAgain } from "@/commands";

export const readme = defineSnippet({
  code: "```js\nconsole.log(1);\n```",
  id: "fixture.readme",
  lang: "md",
});

export const languages = defineCollection({
  build: (lang, { id }) =>
    defineSnippet({ code: `print("${lang}")`, id, lang }),
  idPrefix: "fixture.lang",
  items: ["python", "ruby"],
  key: (lang) => lang,
});
