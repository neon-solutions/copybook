import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { githubUrl, siteConfig } from "./shared";

export const baseOptions = (): BaseLayoutProps => ({
  githubUrl,
  nav: {
    title: (
      <span className="font-heading font-semibold">{siteConfig.name}</span>
    ),
  },
});
