import { createGetUrl } from "fumadocs-core/source";

const defaultSiteUrl =
  process.env.NODE_ENV === "production"
    ? "https://copybook.dev"
    : "http://localhost:3000";

export const siteConfig = {
  description:
    "Define the code snippets and agent prompts in your product as typed, tested, versioned content.",
  locale: "en_US",
  /** For search results, which show about 150 characters. */
  metaDescription:
    "Copybook is an open-source TypeScript toolkit that turns the code snippets and agent prompts in your product into typed, tested, versioned definitions.",
  name: "Copybook",
  publisher: { name: "Neon", url: "https://neon.com" },
  /** The landing page's `<title>`. "Copybook" alone is a common word. */
  title: "Copybook: typed, tested code snippets and agent prompts",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
} as const;

export const registryUrl = `${siteConfig.url}/r`;

export const gitConfig = {
  branch: "main",
  repo: "copybook",
  user: "neon-solutions",
} as const;

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

/** The docs MCP server, and how agents connect to it. */
export const docsMcp = {
  claude: `claude mcp add --transport http copybook-docs ${siteConfig.url}/mcp`,
  json: JSON.stringify(
    { mcpServers: { "copybook-docs": { url: `${siteConfig.url}/mcp` } } },
    null,
    2
  ),
  url: `${siteConfig.url}/mcp`,
} as const;

/**
 * Points search engines at the HTML page a Markdown copy comes from, so the
 * copy isn't indexed alongside it. Agents still read the Markdown.
 */
export const canonicalLink = (path: string) =>
  `<${siteConfig.url}${path}>; rel="canonical"`;

export const docsRoute = "/docs";
export const docsContentRoute = "/llms.mdx/docs";

const getContentUrl = createGetUrl(docsContentRoute);

export const getPageMarkdownUrl = (page: {
  locale?: string;
  slugs: string[];
}) => {
  const segments = [...page.slugs, "content.md"];

  return { segments, url: getContentUrl(segments, page.locale) };
};

/** Open Graph images are 1.91:1, the size every platform crops from. */
export const ogImageSize = { height: 630, width: 1200 } as const;

/** Each docs page's Open Graph image, rendered at build time. */
export const docsImageRoute = "/og/docs";

const getImageUrl = createGetUrl(docsImageRoute);

export const getPageImage = (page: { locale?: string; slugs: string[] }) => {
  const segments = [...page.slugs, "image.png"];

  return { segments, url: getImageUrl(segments, page.locale) };
};
