import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroButton {
  text: string;
  url: string;
}

interface HeroProps {
  badge?: ReactNode;
  buttons?: { primary?: HeroButton; secondary?: HeroButton };
  className?: string;
  description: string;
  heading: string;
  media?: ReactNode;
}

const externalLinkProps = (url: string) =>
  url.startsWith("http")
    ? { rel: "noopener noreferrer", target: "_blank" }
    : {};

export const Hero = ({
  badge,
  buttons,
  className,
  description,
  heading,
  media,
}: HeroProps) => (
  <section className={cn("py-10 sm:py-14", className)}>
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 sm:px-6">
      <div className="flex w-full flex-col items-center gap-4 text-center sm:gap-5">
        {badge}
        <h1 className="font-heading max-w-xl text-4xl font-semibold tracking-tight text-pretty md:text-5xl lg:max-w-3xl">
          {heading}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm text-balance lg:text-base">
          {description}
        </p>
        {buttons?.primary || buttons?.secondary ? (
          <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {buttons.primary ? (
              <Button
                className="w-full sm:w-auto"
                nativeButton={false}
                render={
                  <a
                    href={buttons.primary.url}
                    {...externalLinkProps(buttons.primary.url)}
                  />
                }
                size="lg"
              >
                {buttons.primary.text}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : null}
            {buttons.secondary ? (
              <Button
                className="w-full sm:w-auto"
                nativeButton={false}
                render={
                  <a
                    href={buttons.secondary.url}
                    {...externalLinkProps(buttons.secondary.url)}
                  />
                }
                size="lg"
                variant="outline"
              >
                {buttons.secondary.text}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {media ? (
        <div className="mt-8 flex w-full justify-center sm:mt-10">{media}</div>
      ) : null}
    </div>
  </section>
);
