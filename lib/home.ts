import { render, toText } from "@copybook/core";

import { EMBEDS, ENTRIES } from "@/components/landing/studio-data";
import type { StudioEntry } from "@/components/landing/studio-data";
import { init, setupPrompt } from "@/content/definitions/get-started";
import { githubUrl, siteConfig } from "@/lib/shared";

/** The landing page copy, shared by the page and its Markdown version. */
export const HOME = {
  description:
    "Copybook turns the code snippets and coding-agent prompts in your UI into typed, versioned definitions. It tests every example, measures prompts against real agents, and tracks where each one is shown and when it changed.",
  eyebrow: "Open-source toolkit for in-product snippets and agent prompts",
  meta: ["MIT", "TypeScript", "shadcn registry", "git is the only storage"],
  title: "Your users copy it. Copybook proves it works.",
} as const;

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``;

/** The commands people run first, in order. */
const FIRST_COMMANDS = [
  ["npx copybook list", "what exists, and where it's shown"],
  ["npx copybook snapshot", "write rendered snapshots; commit them"],
  ["npx copybook check", "in CI: fail when a snapshot is stale"],
  ["npx copybook test", "parse, typecheck, and run snippets"],
  ["CI=true npx copybook eval", "give prompts to coding agents"],
  ["npx copybook studio", "browse everything locally"],
] as const;

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

${HOME.description}

## Set it up with a coding agent

Paste this prompt into your coding agent:

${fence("text", toText(render(setupPrompt)))}

## Set it up yourself

${fence("bash", toText(render(init)))}

\`init\` writes \`copybook.config.ts\` and installs \`@copybook/core\` and \`@copybook/cli\`. Then:

${fence(
  "bash",
  FIRST_COMMANDS.map(([command, what]) => `${command}  # ${what}`).join("\n")
)}

## What Copybook Studio shows

\`npx copybook studio\` opens a local UI at http://127.0.0.1:4983 for browsing every definition, editing its params, and previewing the output. The Studio window on ${url} shows the Acme example project (\`examples/acme\` in the repository), with ${ENTRIES.length} definitions:

${ENTRIES.map(describeEntry).join("\n")}

## Learn more

- Quick start: ${url}/docs/quick-start.md
- CLI reference: ${url}/docs/reference/cli.md
- Every docs page, for agents: ${url}/llms.txt
- Every docs page in one file: ${url}/llms-full.txt
- shadcn registry: ${url}/r/registry.json
- Source: ${githubUrl}
`;
};
