import { ChatCenteredTextIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

/** The Prompt Manager mark. */
export const LogoMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "bg-primary text-primary-foreground inline-flex size-7 items-center justify-center",
      className
    )}
  >
    <ChatCenteredTextIcon className="size-4" weight="bold" />
  </span>
);
