import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";

import { LinkButton } from "@/components/landing/primitives";
import { baseOptions } from "@/lib/layout.shared";

// Next.js marks this page noindex and answers with a 404.
export const metadata: Metadata = { title: "Page not found" };

const NotFound = () => (
  <HomeLayout {...baseOptions()}>
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="font-heading mt-3 text-3xl font-semibold">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-balance">
        This page doesn&apos;t exist, or it moved. The docs have everything
        else, and search finds the rest.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton href="/docs">Read the docs</LinkButton>
        <LinkButton href="/" variant="outline">
          Go to the home page
        </LinkButton>
      </div>
    </div>
  </HomeLayout>
);

export default NotFound;
