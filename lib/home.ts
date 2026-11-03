import { render, toText } from "@copybook/core";

import { EMBEDS, ENTRIES } from "@/components/landing/studio-data";
import type { StudioEntry } from "@/components/landing/studio-data";
import { init, setupPrompt } from "@/content/definitions/get-started";
import { commandsMarkdown } from "@/lib/catalog";
import { docsMcp, githubUrl, siteConfig } from "@/lib/shared";

/** The headline, one line per sentence on the page and its images. */
const HEADLINE = ["Snippets that run.", "Agent prompts that work."] as const;

/** The landing page copy, shared by the page and its Markdown version. */
export const HOME = {
  description:
    "Snippets and prompts in your UI break quietly when an SDK, a CLI, or an agent changes. Copybook keeps each one as typed code in your repo, tests snippets on every pull request, runs prompts through real coding agents, and puts every change in review.",
  eyebrow: "Open-source toolkit for the code and prompts your users copy",
  headline: HEADLINE,
  meta: ["MIT", "TypeScript", "shadcn registry", "git is the only storage"],
  title: HEADLINE.join(" "),
} as const;

/**
 * The problems Copybook fixes, in a team's own words, for the Markdown
 * version. Every fix names a shipped feature and the docs page for it.
 */
const PROBLEMS = [
  {
    docs: "/docs/guides/testing",
    fix: "`copybook test` parses, typechecks, and runs every snippet and command you show, on each pull request or only for what it changed.",
    pain: "A user told us the snippet was broken.",
  },
  {
    docs: "/docs/concepts/templates",
    fix: "Define each command once and embed it with `t.cmd()`. Change it, and every prompt and snippet that embeds it changes in the same diff.",
    pain: "The CLI renamed a flag, and half our dialogs still use the old one.",
  },
  {
    docs: "/docs/guides/evals",
    fix: "`copybook eval` runs each prompt through Claude Code or Codex in a sandbox, several times, and checks the commands the agent ran and the files it left against a pass rate.",
    pain: "The setup prompt worked with last month's agent.",
  },
  {
    docs: "/docs/concepts/definitions",
    fix: "Each definition declares where it's shown, `copybook usages` finds the product files that render it, and Studio lists the whole catalog.",
    pain: "Nobody knows which screens show this snippet.",
  },
  {
    docs: "/docs/concepts/snapshots",
    fix: "Every definition renders to a Markdown snapshot committed next to your code, so `git log` is its history, `copybook check` fails CI when one is stale, and `copybook report` comments the rendered diff on pull requests.",
    pain: "When did this prompt change, and who reviewed it?",
  },
  {
    docs: "/docs/concepts/variants",
    fix: "Params are typed and have example values, snippets have a variant per framework, and the registry components render them with tabs and copy buttons.",
    pain: "Every snippet needs the user's project id, framework, and package manager.",
  },
  {
    docs: "/docs/guides/agents",
    fix: "`copybook init` gives coding agents an AGENTS.md section, the Copybook skill, and an MCP server, and `copybook status --json` tells them what to do next.",
    pain: "Our coding agent edits those strings without knowing the rules.",
  },
] as const;

/** The project's own MCP server, as \`copybook init\` registers it with npm. */
export const projectMcp = {
  claude: "claude mcp add copybook -- npx --no copybook mcp",
  codex: "codex mcp add copybook -- npx --no copybook mcp",
  json: JSON.stringify(
    {
      mcpServers: {
        copybook: { args: ["--no", "copybook", "mcp"], command: "npx" },
      },
    },
    null,
    2
  ),
  tools: [
    "status",
    "find_definitions",
    "get_definition",
    "render",
    "check",
    "write_snapshots",
    "prune_snapshots",
    "run_tests",
  ],
} as const;

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

const describeEntry = ({ definition, source }: StudioEntry) => {
  const placements = definition.placements ?? [];
  const embeds = EMBEDS.get(definition.id) ?? [];
  const details = [
    placements.length > 0 ? `shown at ${placements.join(", ")}` : "",
    embeds.length > 0 ? `embeds ${embeds.join(", ")}` : "",
    `defined in \`${source}\``,
  ].filter(Boolean);
  const sentence = details.join("; ");
  return `- \`${definition.id}\` (${definition.kind})${definition.title ? `: ${definition.title}` : ""}. ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

/** The landing page as Markdown, for agents. */
export const homeMarkdown = () => {
  const { url } = siteConfig;
  return `# ${siteConfig.name}

> ${siteConfig.description}

**${HOME.title}**

${HOME.description}

## What it fixes

${PROBLEMS.map(({ docs, fix, pain }) => `- "${pain}" ${fix} Docs: ${url}${docs}.md`).join("\n")}

## Set it up with a coding agent

Paste this prompt into your coding agent:

${fence("text", toText(render(setupPrompt)))}

## Set it up yourself

${fence("bash", toText(render(init)))}

\`init\` writes \`copybook.config.ts\`, installs \`@copybook/core\` and \`@copybook/cli\`, and sets up coding agents: an \`AGENTS.md\` section, the Copybook skill, and the \`copybook\` MCP server. Then run \`npx copybook status --json\`: its \`next\` field lists what to do, with the command and MCP tool for each step.

## Every command

Every command except \`report\` takes \`--json\`. Exit codes: 0 when everything is fine, 1 when a command found problems, 2 when it couldn't run.

${commandsMarkdown()}

## What Copybook Studio shows

\`npx copybook studio\` opens a local UI at http://127.0.0.1:4983 for browsing every definition, editing its params, and previewing the output. The Studio window on ${url} shows the Acme example project (\`examples/acme\` in the repository), with ${ENTRIES.length} definitions:

${ENTRIES.map(describeEntry).join("\n")}

## Connect a coding agent

\`copybook init\` writes everything an agent needs: a Copybook section in \`AGENTS.md\`, the Copybook skill in \`.agents/skills/copybook\`, and the \`copybook\` MCP server in \`.mcp.json\`. The server runs in your project with \`npx --no copybook mcp\`, and its tools are ${projectMcp.tools.map((tool) => `\`${tool}\``).join(", ")}. To add it yourself:

${fence("bash", `${projectMcp.claude}\n${projectMcp.codex}`)}

Or in any MCP JSON config, such as \`.cursor/mcp.json\`:

${fence("json", projectMcp.json)}

The full guide: ${siteConfig.url}/docs/guides/agents.md

## Read the docs over MCP

${docsMcp.url} is an MCP server with \`list_pages\`, \`get_page\`, and \`search\` tools for these docs. Add it to Claude Code with:

${fence("bash", docsMcp.claude)}

Or to any agent that reads an MCP JSON config:

${fence("json", docsMcp.json)}

## Learn more

- Quick start: ${url}/docs/quick-start.md
- CLI reference: ${url}/docs/reference/cli.md
- Every docs page, for agents: ${url}/llms.txt
- Every docs page in one file: ${url}/llms-full.txt
- shadcn registry: ${url}/r/registry.json
- Source: ${githubUrl}
`;
};
