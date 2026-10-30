"use client";

import {
  GithubLogoIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { useTheme } from "next-themes";
import Link from "next/link";

import { LinkButton, Logo } from "@/components/landing/primitives";
import { githubUrl } from "@/lib/shared";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/quick-start", label: "Quick start" },
  { href: "/docs/components", label: "Components" },
  { href: "/docs/guides/studio", label: "Studio" },
] as const;

export const SiteNav = () => {
  const { setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="fixed inset-x-0 top-4 z-40 px-4">
      <nav
        aria-label="Main"
        className="glass border-border max-w-page mx-auto flex h-12 items-center gap-6 rounded-lg border pr-1.5 pl-4"
      >
        <a
          aria-label="Copybook, back to top"
          className="rounded-sm"
          href="#top"
        >
          <Logo />
        </a>

        <ul className="mx-auto hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                className="text-nav text-muted-foreground hover:text-foreground font-medium transition-colors"
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <button
            className="text-muted-foreground hover:text-foreground text-nav focus-visible:ring-ring/50 hover:bg-accent inline-flex h-9 items-center gap-2 rounded-lg px-3 font-medium transition-colors outline-none focus-visible:ring-2"
            onClick={() => setOpenSearch(true)}
            type="button"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only">Search</span>
            <kbd className="border-border bg-secondary text-muted-foreground hidden rounded-sm border px-1.5 font-mono text-xs sm:inline">
              ⌘K
            </kbd>
          </button>
          <button
            aria-label="Toggle theme"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 hover:bg-accent inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            title="Toggle theme (D)"
            type="button"
          >
            <SunIcon aria-hidden="true" className="hidden size-4 dark:block" />
            <MoonIcon aria-hidden="true" className="size-4 dark:hidden" />
          </button>
          <LinkButton external href={githubUrl}>
            <GithubLogoIcon aria-hidden="true" weight="fill" />
            <span className="sr-only sm:not-sr-only">GitHub</span>
          </LinkButton>
        </div>
      </nav>
    </header>
  );
};
