import { render } from "@copybook/core";

import { AgentPrompt } from "@/components/copybook/agent-prompt";
import { setupPrompt } from "@/content/definitions/get-started";
import { projectMcp } from "@/lib/home";
import { docsMcp, siteConfig } from "@/lib/shared";

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
      <h4 className="eyebrow">Connect your coding agent</h4>
      <p className="text-muted-foreground text-sm">
        <code className="text-foreground font-mono">copybook init</code> adds an
        AGENTS.md section, the Copybook skill, and this MCP server to your
        project. Its tools find, read, render, check, snapshot, and test your
        definitions. To add it yourself:
      </p>
      <pre className="bg-muted text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs">
        {`${projectMcp.claude}\n${projectMcp.codex}`}
      </pre>
      <pre className="bg-muted text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs">
        {projectMcp.json}
      </pre>
    </section>
    <section className="flex flex-col gap-3">
      <h4 className="eyebrow">Docs over MCP</h4>
      <p className="text-muted-foreground text-sm">
        <code className="text-foreground font-mono">{docsMcp.url}</code> lists,
        reads, and searches every docs page. Add it to Claude Code:
      </p>
      <pre className="bg-muted text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs">
        {docsMcp.claude}
      </pre>
      <p className="text-muted-foreground text-sm">
        Or to any agent that reads an MCP JSON config:
      </p>
      <pre className="bg-muted text-foreground overflow-x-auto rounded-md p-3 font-mono text-xs">
        {docsMcp.json}
      </pre>
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
