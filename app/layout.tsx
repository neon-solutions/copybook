import { Geist_Mono, Nunito_Sans, Outfit } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
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
    <body>
      <ThemeProvider>{children}</ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
