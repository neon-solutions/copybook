import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito_Sans, Outfit } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { ThemeHotkey } from "@/components/theme-hotkey";
import { siteConfig } from "@/lib/shared";
import { cn } from "@/lib/utils";

const nunitoSansHeading = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  authors: [siteConfig.publisher],
  creator: siteConfig.publisher.name,
  description: siteConfig.metaDescription,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    description: siteConfig.metaDescription,
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    type: "website",
    url: "/",
  },
  publisher: siteConfig.publisher.name,
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  // X falls back to og:image, so the OG images serve it too.
  twitter: { card: "summary_large_image" },
};

/** The landing page's backgrounds, for the browser's toolbar. */
export const viewport: Viewport = {
  themeColor: [
    { color: "#ffffff", media: "(prefers-color-scheme: light)" },
    { color: "#040506", media: "(prefers-color-scheme: dark)" },
  ],
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <html
    className={cn(
      "antialiased",
      fontMono.variable,
      "font-sans",
      outfit.variable,
      nunitoSansHeading.variable
    )}
    lang="en"
    suppressHydrationWarning
  >
    <body className="flex min-h-screen flex-col">
      <RootProvider
        theme={{
          attribute: "class",
          defaultTheme: "system",
          disableTransitionOnChange: true,
          enableSystem: true,
        }}
      >
        <ThemeHotkey />
        {children}
      </RootProvider>
    </body>
  </html>
);

export default RootLayout;
