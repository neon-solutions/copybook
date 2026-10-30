import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Serve each docs page as Markdown at `/docs/<page>.md`.
  rewrites: () =>
    Promise.resolve([
      {
        destination: "/llms.mdx/docs/:path*/content.md",
        source: "/docs/:path*.md",
      },
    ]),
  transpilePackages: ["@copybook/example-acme"],
};

export default withMDX(nextConfig);
