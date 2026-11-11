import { notFound } from "next/navigation";

import { canonicalLink, getPageMarkdownUrl } from "@/lib/shared";
import { docsLlms, source } from "@/lib/source";

export const revalidate = false;
// Every page is rendered at build time; other paths are 404s.
export const dynamicParams = false;

export const GET = async (
  _request: Request,
  { params }: RouteContext<"/llms.mdx/docs/[[...slug]]">
) => {
  const { slug } = await params;
  // The last segment is always `content.md`.
  if (!slug || slug.at(-1) !== "content.md") {
    notFound();
  }

  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  return new Response(await docsLlms.page(page), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: canonicalLink(page.url),
    },
  });
};

export const generateStaticParams = () =>
  source.getPages().map((page) => ({
    slug: getPageMarkdownUrl(page).segments,
  }));
