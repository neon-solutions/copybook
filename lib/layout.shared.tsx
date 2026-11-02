import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { CopybookMark } from "@/components/copybook-mark";

import { githubUrl, siteConfig } from "./shared";

export const baseOptions = (): BaseLayoutProps => ({
  githubUrl,
  nav: {
    title: (
      <>
        <CopybookMark className="size-5" />
        <span className="font-heading font-semibold">{siteConfig.name}</span>
      </>
    ),
  },
});
