import corePackage from "@copybook/core/package.json";
import { getBreadcrumbItems } from "fumadocs-core/breadcrumb";

import { docsRoute, getPageImage, githubUrl, siteConfig } from "./shared";
import { source } from "./source";

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

/** The site's host, as shown on images: `copybook.dev`. */
export const siteHost = new URL(siteConfig.url).host;

/**
 * The folders a docs page sits in, such as `Concepts`, with the URL of each
 * folder's index page when it has one. Top-level pages have none.
 */
export const getPageSections = (page: DocsPage) =>
  getBreadcrumbItems(page.url, source.getPageTree()).flatMap((item, depth) =>
    typeof item.name === "string"
      ? [
          {
            name: item.name,
            // An `index` listed in meta.json is a plain page, not the
            // folder's, so find it by path.
            url:
              item.url ?? source.getPage(page.slugs.slice(0, depth + 1))?.url,
          },
        ]
      : []
  );

/*
 * Vercel clones a few commits deep unless VERCEL_DEEP_CLONE is set, and in
 * a shallow clone the oldest commit claims every file, so git's dates are
 * only used from a full clone.
 */
const hasFullHistory =
  !process.env.VERCEL || process.env.VERCEL_DEEP_CLONE === "true";

/** When the page's file last changed in git, if that's known. */
export const getLastModified = (page: DocsPage) =>
  hasFullHistory ? page.data.lastModified : undefined;

/*
 * Structured data, as schema.org JSON-LD. The nodes reference each other
 * by `@id`, so the publisher and the site are described once.
 */

const absolute = (path: string) => `${siteConfig.url}${path}`;

const ids = {
  publisher: `${siteConfig.publisher.url}/#organization`,
  software: absolute("/#software"),
  website: absolute("/#website"),
} as const;

const publisher = {
  "@id": ids.publisher,
  "@type": "Organization",
  name: siteConfig.publisher.name,
  url: siteConfig.publisher.url,
};

/**
 * The landing page: the site, which gives Google its name for results,
 * and Copybook as a free developer tool.
 */
export const homeJsonLd = () => ({
  "@context": "https://schema.org",
  "@graph": [
    publisher,
    {
      "@id": ids.website,
      "@type": "WebSite",
      alternateName: siteHost,
      description: siteConfig.metaDescription,
      inLanguage: "en",
      name: siteConfig.name,
      publisher: { "@id": ids.publisher },
      url: absolute("/"),
    },
    {
      "@id": ids.software,
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
      description: siteConfig.metaDescription,
      image: absolute("/opengraph-image"),
      license: "https://opensource.org/licenses/MIT",
      name: siteConfig.name,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      operatingSystem: "macOS, Linux, Windows",
      publisher: { "@id": ids.publisher },
      sameAs: [
        githubUrl,
        "https://www.npmjs.com/package/@copybook/core",
        "https://www.npmjs.com/package/@copybook/cli",
      ],
      softwareVersion: corePackage.version,
      url: absolute("/"),
    },
  ],
});

/**
 * A docs page: the article, and its breadcrumb trail. Google needs a URL
 * for every crumb but the last, so folders without an index page are left
 * out, and a folder's index page ends the trail with the folder's name.
 */
export const docsPageJsonLd = (page: DocsPage) => {
  const url = absolute(page.url);
  const trail: { name: string; url: string }[] = [
    { name: "Docs", url: docsRoute },
  ];
  for (const section of getPageSections(page)) {
    if (section.url) {
      trail.push({ name: section.name, url: section.url });
    }
  }
  if (trail.at(-1)?.url !== page.url) {
    trail.push({ name: page.data.title, url: page.url });
  }

  const article = {
    "@id": `${url}#article`,
    "@type": "TechArticle",
    about: { "@id": ids.software },
    author: { "@id": ids.publisher },
    dateModified: getLastModified(page)?.toISOString(),
    description: page.data.metaDescription ?? page.data.description,
    headline: page.data.metaTitle ?? page.data.title,
    image: absolute(getPageImage(page).url),
    inLanguage: "en",
    isPartOf: { "@id": ids.website },
    mainEntityOfPage: url,
    publisher,
    url,
  };

  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      item: absolute(crumb.url),
      name: crumb.name,
      position: index + 1,
    })),
  };

  return {
    "@context": "https://schema.org",
    // A trail of one, the docs home itself, isn't a breadcrumb.
    "@graph": trail.length > 1 ? [article, breadcrumbs] : [article],
  };
};
