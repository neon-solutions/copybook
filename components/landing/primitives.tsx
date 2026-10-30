import { ChatCenteredTextIcon } from "@phosphor-icons/react/dist/ssr";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Container = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("max-w-page mx-auto w-full px-6", className)}>
    {children}
  </div>
);

/** The Copybook mark: the one place Neon green appears outside the aurora. */
export const Logo = () => (
  <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
    <span
      aria-hidden="true"
      className="bg-brand-neon inline-flex size-6 items-center justify-center rounded-md text-black"
    >
      <ChatCenteredTextIcon className="size-4" weight="fill" />
    </span>
    <span className="text-foreground text-nav font-medium">Copybook</span>
  </span>
);

const linkButtonVariants = cva(
  "focus-visible:ring-ring/50 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: { size: "default", variant: "primary" },
    variants: {
      size: { default: "h-9 px-3.5", lg: "h-11 px-5" },
      variant: {
        ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
        outline:
          "border-border text-foreground bg-background/70 hover:bg-accent border backdrop-blur-sm",
        primary:
          "bg-primary text-primary-foreground shadow-button hover:bg-primary/85",
      },
    },
  }
);

/** A link that looks like a button. External links open in a new tab. */
export const LinkButton = ({
  children,
  className,
  external,
  href,
  size,
  variant,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> &
  VariantProps<typeof linkButtonVariants> & {
    external?: boolean;
    href: string;
  }) => (
  <Link
    className={cn(linkButtonVariants({ size, variant }), className)}
    href={href}
    {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
    {...props}
  >
    {children}
  </Link>
);

/** Items separated by a faint pipe, for mono meta strips. */
export const MetaStrip = ({
  className,
  items,
}: {
  className?: string;
  items: readonly ReactNode[];
}) => (
  <p className={cn("text-muted-foreground font-mono text-xs", className)}>
    {items.map((item, index) => (
      // The strip is static, so positions are stable keys.
      // oxlint-disable-next-line react/no-array-index-key
      <span key={index}>
        {index > 0 ? (
          <span aria-hidden="true" className="text-faint px-2">
            |
          </span>
        ) : null}
        {item}
      </span>
    ))}
  </p>
);
