import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

/** The landing page follows the same light or dark theme as the docs. */
const HomeLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div className={cn("landing flex flex-1 flex-col", inter.variable)}>
    <a
      className="bg-primary text-primary-foreground fixed top-3 left-3 z-50 -translate-y-20 rounded-lg px-3 py-2 text-sm font-medium focus-visible:translate-y-0"
      href="#main"
    >
      Skip to content
    </a>
    <SiteNav />
    <main className="flex-1" id="main">
      {children}
    </main>
    <SiteFooter />
  </div>
);

export default HomeLayout;
