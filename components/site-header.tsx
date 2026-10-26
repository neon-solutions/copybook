"use client";

import { GithubLogoIcon } from "@phosphor-icons/react";
import { FullSearchTrigger } from "fumadocs-ui/layouts/shared/slots/search-trigger";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import { githubUrl, siteConfig } from "@/lib/shared";
import { cn } from "@/lib/utils";

const NAV_LINKS = [{ href: "/docs", label: "Docs" }] as const;

const isActivePath = (pathname: string | null, href: string) =>
  pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));

export const SiteHeader = () => {
  const pathname = usePathname();

  return (
    <header>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link
            aria-current={pathname === "/" ? "page" : undefined}
            className="font-heading mr-2 flex items-center gap-2 font-semibold"
            href="/"
          >
            <LogoMark />
            <span className="hidden sm:inline">{siteConfig.name}</span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = isActivePath(pathname, link.href);
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    buttonVariants({ size: "sm", variant: "ghost" }),
                    isActive && "bg-muted text-foreground"
                  )}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <FullSearchTrigger className="hidden w-56 md:flex" />
          <Button
            aria-label="GitHub repository"
            nativeButton={false}
            render={
              <a
                aria-label="GitHub repository"
                href={githubUrl}
                rel="noopener noreferrer"
                target="_blank"
              />
            }
            size="icon-sm"
            variant="ghost"
          >
            <GithubLogoIcon />
          </Button>
          <ModeSwitcher />
        </div>
      </div>
    </header>
  );
};
