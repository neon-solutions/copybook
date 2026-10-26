import { createGetUrl } from "fumadocs-core/source";

export const siteConfig = {
  description:
    "Define the code snippets and agent prompts in your product as typed, tested, versioned content.",
  name: "Prompt Manager",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const registryUrl = `${siteConfig.url}/r`;

export const gitConfig = {
  branch: "main",
  repo: "prompt-manager",
  user: "TheOrcDev",
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
