import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

/** Docs search, shared by the search API and the docs MCP server. */
export const searchServer = createFromSource(source, {
  language: "english",
});
