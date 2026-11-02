import { render } from "@copybook/core";

import { AgentPrompt } from "@/components/copybook/agent-prompt";
import { setupPrompt } from "@/content/definitions/get-started";
import { siteConfig } from "@/lib/shared";

const MARKDOWN = [
  { file: "index.md", what: "this page, for agents" },
  { file: "llms.txt", what: "every docs page" },
  { file: "llms-full.txt", what: "every docs page in one file" },
  { file: "docs/quick-start.md", what: "the quick start" },
] as const;

/** What a coding agent needs to set up Copybook, as a Studio panel. */
export const AgentsView = () => (
  <>
    <header className="flex flex-col gap-2">
      <p className="eyebrow">Project</p>
      <h3 className="text-foreground text-lg font-semibold">Agents</h3>
      <p className="text-body text-muted-foreground">
        Hand Copybook to your coding agent. It reads the docs, moves the
        snippets and prompts in your UI into definitions, and keeps their
        snapshots and tests passing.
      </p>
    </header>
    <section className="flex flex-col gap-3">
      <h4 className="eyebrow">Setup prompt</h4>
      <AgentPrompt rendered={render(setupPrompt)} title="Set up Copybook" />
    </section>
    <section className="flex flex-col gap-3">
      <h4 className="eyebrow">Docs as Markdown</h4>
      <ul className="divide-border border-border divide-y rounded-md border">
        {MARKDOWN.map(({ file, what }) => (
          <li
            className="flex items-center justify-between gap-4 px-3 py-2 text-xs"
            key={file}
          >
            <a
              className="text-foreground font-mono underline-offset-4 hover:underline"
              href={`/${file}`}
            >
              {`${siteConfig.url}/${file}`}
            </a>
            <span className="text-muted-foreground">{what}</span>
          </li>
        ))}
      </ul>
    </section>
  </>
);
