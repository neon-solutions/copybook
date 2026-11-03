import corePackage from "@copybook/core/package.json";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";

import { searchServer } from "@/lib/search";
import { siteConfig } from "@/lib/shared";
import { docsLlms, source } from "@/lib/source";

const INSTRUCTIONS = `The Copybook docs (${siteConfig.url}/docs). ${siteConfig.metaDescription} Use list_pages to see every page, get_page with a page URL such as /docs/quick-start to read it as Markdown, and search to find pages by keyword.`;

/** A stateless MCP server for the docs: list, read, and search pages. */
const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "copybook-docs", version: corePackage.version },
    { instructions: INSTRUCTIONS }
  );
  registerSourceTools(server, source, docsLlms);
  registerSearchTool(server, searchServer);
  return server;
});

const handle = (request: Request) => handler.fetch(request);

export const DELETE = handle;
export const GET = handle;
export const POST = handle;
