import { ArrowRightIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import {
  Container,
  LinkButton,
  MetaStrip,
} from "@/components/landing/primitives";
import { NeonAurora } from "@/components/neon-aurora/neon-aurora";
import { HOME } from "@/lib/home";
import { githubUrl } from "@/lib/shared";

/** The copy rises in, staggered, while the aurora comes alive. */
export const Hero = ({ window }: { window?: ReactNode }) => (
  <section
    aria-labelledby="top-title"
    className="pb-section relative isolate pt-36 md:pt-44"
    id="top"
  >
    <div
      aria-hidden="true"
      className="hero-backdrop bg-background pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden"
    >
      {/* The shader draws on black; light mode inverts it to ink on paper. */}
      <NeonAurora className="hero-mask absolute inset-0 hue-rotate-180 invert dark:hue-rotate-0 dark:invert-0" />
      <div className="to-background absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent" />
    </div>

    <Container className="flex flex-col items-center text-center">
      <p className="hero-enter hero-delay-150 eyebrow">{HOME.eyebrow}</p>
      <h1
        className="hero-enter hero-delay-250 text-display tracking-display text-foreground mt-5 max-w-4xl font-normal text-balance"
        id="top-title"
      >
        {HOME.title}
      </h1>
      <p className="hero-enter hero-delay-400 text-body-lg text-muted-foreground mt-6 max-w-xl text-pretty">
        {HOME.description}
      </p>
      <div className="hero-enter hero-delay-550 mt-8 flex flex-wrap justify-center gap-2">
        <LinkButton href="/docs/quick-start" size="lg">
          Get started
          <ArrowRightIcon aria-hidden="true" />
        </LinkButton>
        <LinkButton external href={githubUrl} size="lg" variant="outline">
          <GithubLogoIcon aria-hidden="true" weight="fill" />
          View on GitHub
        </LinkButton>
      </div>
      <div className="hero-enter hero-delay-650 mt-5">
        <MetaStrip items={[...HOME.meta]} />
      </div>
      {window ? (
        <div className="hero-enter-window hero-delay-800 mt-16 w-full max-w-5xl text-left">
          {window}
        </div>
      ) : null}
    </Container>
  </section>
);
