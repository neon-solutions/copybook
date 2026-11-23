"use client";

import { CheckIcon, RobotIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { linkButtonVariants } from "@/components/landing/primitives";

const RESET_AFTER_MS = 2000;

/** Copies the setup prompt, so people can hand Copybook to their agent. */
export const CopyPromptButton = ({ prompt }: { prompt: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), RESET_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  };

  return (
    <button
      className={linkButtonVariants({ size: "lg", variant: "outline" })}
      onClick={copy}
      type="button"
    >
      {copied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <RobotIcon aria-hidden="true" />
      )}
      <span aria-live="polite">
        {copied ? "Copied" : "Copy prompt for your agent"}
      </span>
    </button>
  );
};
