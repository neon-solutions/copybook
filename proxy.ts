import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { docsContentRoute, docsRoute } from "./lib/shared";

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`
);

const rewriteHome = (path: string) => (path === "/" ? "/index.md" : false);

/**
 * Serves the landing page and docs pages as Markdown to agents that ask for
 * it via `Accept`.
 */
export const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // `next.config` rewrites explicit `.md` URLs, which have one representation.
  if (pathname.endsWith(".md")) {
    return NextResponse.next();
  }

  if (isMarkdownPreferred(request)) {
    const negotiated = rewriteHome(pathname) || rewriteDocs(pathname);

    if (negotiated) {
      return NextResponse.rewrite(new URL(negotiated, request.nextUrl), {
        // This URL has two representations, selected by `Accept`.
        headers: { Vary: "Accept" },
      });
    }
  }

  // HTML responses share the URL with Markdown negotiation.
  return NextResponse.next({
    headers: { Vary: "Accept" },
  });
};

export const config = {
  matcher: ["/", "/docs/:path*"],
};
