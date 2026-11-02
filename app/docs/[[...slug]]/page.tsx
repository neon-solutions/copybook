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

import { getMDXComponents } from "@/components/mdx";
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

  // A segment's openGraph replaces the root layout's, so repeat siteName,
  // and give the page its own image instead of the landing page's.
  return {
    alternates: { canonical: page.url },
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      images: {
        ...ogImageSize,
        alt: `${page.data.title}, in the ${siteConfig.name} docs`,
        type: "image/png",
        url: getPageImage(page).url,
      },
      siteName: siteConfig.name,
      title: page.data.title,
      type: "article",
      url: page.url,
    },
    title: page.data.title,
  };
};
