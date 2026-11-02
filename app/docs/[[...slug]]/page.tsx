import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import { docsPageJsonLd, getLastModified } from "@/lib/seo";
import {
  getPageImage,
  getPageMarkdownUrl,
  gitConfig,
  ogImageSize,
  siteConfig,
} from "@/lib/shared";
import { source } from "@/lib/source";

const Page = async (props: PageProps<"/docs/[[...slug]]">) => {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const MdxContent = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <JsonLd data={docsPageJsonLd(page)} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
          markdownUrl={markdownUrl}
        />
      </div>
      <DocsBody>
        <MdxContent
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
};

export default Page;

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async (
  props: PageProps<"/docs/[[...slug]]">
): Promise<Metadata> => {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  // Search results and link previews get the longer meta fields; the page
  // itself and its image keep the short title and description.
  const title = page.data.metaTitle ?? page.data.title;
  const description = page.data.metaDescription ?? page.data.description;

  // A segment's openGraph replaces the root layout's, so repeat siteName,
  // and give the page its own image instead of the landing page's.
  return {
    alternates: { canonical: page.url },
    description,
    openGraph: {
      description,
      images: {
        ...ogImageSize,
        alt: `${page.data.title}, in the ${siteConfig.name} docs`,
        type: "image/png",
        url: getPageImage(page).url,
      },
      locale: siteConfig.locale,
      modifiedTime: getLastModified(page)?.toISOString(),
      siteName: siteConfig.name,
      title,
      type: "article",
      url: page.url,
    },
    title,
  };
};
