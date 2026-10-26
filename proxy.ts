import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { docsContentRoute, docsRoute } from "./lib/shared";

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`
);

/** Serves docs pages as Markdown to agents that ask for it via `Accept`. */
export const proxy = (request: NextRequest) => {
  if (isMarkdownPreferred(request)) {
    const negotiated = rewriteDocs(request.nextUrl.pathname);

    if (negotiated) {
      return NextResponse.rewrite(new URL(negotiated, request.nextUrl), {
        // This URL has two representations, selected by `Accept`.
        headers: { Vary: "Accept" },
      });
    }
  }

  return NextResponse.next();
};

export const config = {
  matcher: "/docs/:path*",
};
