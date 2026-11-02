import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/shared";
import { source } from "@/lib/source";

const sitemap = (): MetadataRoute.Sitemap => [
  { url: siteConfig.url },
  ...source.getPages().map((page) => ({ url: `${siteConfig.url}${page.url}` })),
];

export default sitemap;
