import corePackage from "@copybook/core/package.json";
import Link from "next/link";

import { Container, Logo, MetaStrip } from "@/components/landing/primitives";
import { githubUrl } from "@/lib/shared";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/quick-start", label: "Quick start" },
  { href: "/docs/changelog", label: "Changelog" },
  { external: true, href: githubUrl, label: "GitHub" },
] as const;

const externalProps = { rel: "noopener noreferrer", target: "_blank" } as const;

export const SiteFooter = () => (
  <footer className="border-divider border-t py-16">
    <Container className="flex flex-col items-center gap-8 text-center">
      <Logo />
      <ul className="text-nav flex flex-wrap justify-center gap-x-6 gap-y-2 font-medium">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={link.href}
              {...("external" in link ? externalProps : {})}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <MetaStrip
        items={[
          "MIT",
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/docs/changelog"
            key="version"
          >
            v{corePackage.version}
          </Link>,
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/r/registry.json"
            key="registry"
            prefetch={false}
          >
            registry.json
          </Link>,
        ]}
      />
      <p className="text-muted-foreground text-sm">
        Made by{" "}
        <a
          className="text-foreground underline-offset-4 hover:underline"
          href="https://neon.com"
          {...externalProps}
        >
          Neon
        </a>
      </p>
    </Container>
  </footer>
);
