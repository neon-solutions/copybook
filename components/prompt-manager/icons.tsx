import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const Icon = ({ children, ...props }: IconProps) => (
  <svg
    aria-hidden="true"
    fill="none"
    height="1em"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    {children}
  </svg>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="13" rx="2" width="13" x="8" y="8" />
    <path d="M4 16V5a1 1 0 0 1 1-1h11" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);

export const AgentIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="12" rx="2" width="16" x="4" y="8" />
    <path d="M12 8V4M9 14h.01M15 14h.01" />
  </Icon>
);

export const TerminalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 7 5 5-5 5M12 17h7" />
  </Icon>
);

export const WarningIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </Icon>
);
