import { commandsMarkdown } from "@/lib/catalog";
import { docsMcp, siteConfig } from "@/lib/shared";
import { docsLlms } from "@/lib/source";

export const revalidate = false;

const TITLE = /^# .*\n/u;
const DOCS_LINK = /\]\(\/docs[^)]*\)/gu;

/**
 * Agents fetch this file on its own, so it names the project and links to
 * each page's Markdown with an absolute URL. The page tree's own title is
 * "Documentation".
 */
export const GET = async () => {
  const index = await docsLlms.index();
  const header = `# ${siteConfig.name}

> ${siteConfig.description}

Start here: ${siteConfig.url}/index.md explains what Copybook is, how to set it up, and the prompt to give a coding agent.

Every page in one file: ${siteConfig.url}/llms-full.txt

Read, list, and search these docs over MCP: ${docsMcp.url}

## CLI commands

${commandsMarkdown()}

## Docs
`;

  return new Response(
    index
      .replace(TITLE, header)
      .replaceAll(
        DOCS_LINK,
        (link) => `](${siteConfig.url}${link.slice(2, -1)}.md)`
      )
  );
};
