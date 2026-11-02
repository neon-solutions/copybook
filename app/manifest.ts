import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/shared";

/** Names and icons for home screens and bookmarks. */
const manifest = (): MetadataRoute.Manifest => ({
  background_color: "#040506",
  description: siteConfig.metaDescription,
  display: "browser",
  icons: [
    { sizes: "any", src: "/icon.svg", type: "image/svg+xml" },
    { sizes: "180x180", src: "/apple-icon.png", type: "image/png" },
  ],
  name: siteConfig.name,
  short_name: siteConfig.name,
  start_url: "/",
  theme_color: "#040506",
});

export default manifest;
