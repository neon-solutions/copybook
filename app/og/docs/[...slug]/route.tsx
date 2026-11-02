import { notFound } from "next/navigation";

import { OgDocsCard } from "@/components/og/og-card";
import { renderOgImage } from "@/lib/og";
import { getPageSections, siteHost } from "@/lib/seo";
import { getPageImage } from "@/lib/shared";
import { source } from "@/lib/source";

export const revalidate = false;
// Every image is rendered at build time; other paths are 404s.
export const dynamicParams = false;

export const GET = async (
  _request: Request,
  { params }: RouteContext<"/og/docs/[...slug]">
) => {
  const { slug } = await params;
  // The last segment is always `image.png`.
  const page = source.getPage(slug.slice(0, -1));
  if (!page) {
    notFound();
  }

  const sections = getPageSections(page).map((section) => section.name);

  return renderOgImage(
    <OgDocsCard
      description={page.data.description}
      path={`${siteHost}${page.url}`}
      section={["Docs", ...sections].join(" · ")}
      title={page.data.title}
    />
  );
};

export const generateStaticParams = () =>
  source.getPages().map((page) => ({ slug: getPageImage(page).segments }));
