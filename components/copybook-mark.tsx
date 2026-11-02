import type { SVGProps } from "react";

/**
 * The Copybook mark: a prompt chevron drawn as the two pages of an open book,
 * with a Neon cursor. The chevron takes the current text color.
 */
export const CopybookMark = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
    <path d="M0 0 14.5 6.5V17.5L0 24V17L13 12 0 7Z" fill="currentColor" />
    <rect className="fill-brand-neon" height="2.5" width="7" x="17" y="15" />
  </svg>
);
