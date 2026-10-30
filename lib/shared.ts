import { createGetUrl } from "fumadocs-core/source";

const defaultSiteUrl =
  process.env.NODE_ENV === "production"
    ? "https://copybook.dev"
    : "http://localhost:3000";

export const siteConfig = {
  description:
    "Define the code snippets and agent prompts in your product as typed, tested, versioned content.",
  name: "Copybook",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
} as const;

export const registryUrl = `${siteConfig.url}/r`;

export const gitConfig = {
  branch: "main",
  repo: "copybook",
  user: "neon-solutions",
} as const;

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

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
