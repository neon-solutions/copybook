import Link from "next/link";

import { GitHubLink } from "@/components/landing/github-link";
import { LinkButton, Logo } from "@/components/landing/primitives";

export const SiteNav = () => (
  <header className="fixed inset-x-0 top-4 z-40 px-4">
    <nav
      aria-label="Main"
      className="glass border-border max-w-page mx-auto flex h-12 items-center justify-between gap-6 rounded-lg border pr-1.5 pl-4"
    >
      <Link aria-label="Copybook home" className="rounded-sm" href="/">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <LinkButton href="/docs" variant="ghost">
          Docs
        </LinkButton>
        <GitHubLink />
      </div>
    </nav>
  </header>
);
