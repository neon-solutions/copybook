import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/shared";

// Everything else stays open, including the Markdown and llms.txt files
// agents read, and /og/, which X's crawler needs for link previews.
const robots = (): MetadataRoute.Robots => ({
  rules: { allow: "/", disallow: ["/api/", "/mcp"], userAgent: "*" },
  sitemap: `${siteConfig.url}/sitemap.xml`,
});

export default robots;
