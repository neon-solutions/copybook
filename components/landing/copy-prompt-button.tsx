"use client";

import { CheckIcon, RobotIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { linkButtonVariants } from "@/components/landing/primitives";

const RESET_AFTER_MS = 2000;
const IDLE_LABEL = "Copy prompt for your agent";

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
      {/* The hidden label holds the button at its idle width while "Copied" shows. */}
      <span className="grid text-center">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
          {IDLE_LABEL}
        </span>
        <span aria-live="polite" className="col-start-1 row-start-1">
          {copied ? "Copied" : IDLE_LABEL}
        </span>
      </span>
    </button>
  );
};
