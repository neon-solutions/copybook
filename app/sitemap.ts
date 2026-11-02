import type { MetadataRoute } from "next";

import { getLastModified } from "@/lib/seo";
import { siteConfig } from "@/lib/shared";
import { source } from "@/lib/source";

// Google ignores changefreq and priority, and only trusts lastmod when it's
// accurate, so pages without a git date have none.
const sitemap = (): MetadataRoute.Sitemap => [
  { url: siteConfig.url },
  ...source.getPages().map((page) => ({
    lastModified: getLastModified(page),
    url: `${siteConfig.url}${page.url}`,
  })),
];

export default sitemap;
