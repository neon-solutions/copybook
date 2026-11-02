import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";

import { siteConfig } from "./shared";
import { source } from "./source";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

/** The site's host, as shown on images: `copybook.dev`. */
export const siteHost = new URL(siteConfig.url).host;

/** The folders a docs page sits in, such as `Concepts`. Top-level pages have none. */
export const getPageSections = (page: DocsPage) =>
  getBreadcrumbItems(page.url, source.getPageTree()).flatMap((item) =>
    typeof item.name === "string" ? [{ name: item.name, url: item.url }] : []
  );
