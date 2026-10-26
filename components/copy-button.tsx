"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const RESET_AFTER_MS = 2000;

interface CopyButtonProps {
  className?: string;
  label?: string;
  onCopy?: (value: string) => void;
  value: string;
}

export const CopyButton = ({
  className,
  label = "Copy to clipboard",
  onCopy,
  value,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), RESET_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    onCopy?.(value);
  };

  return (
    <Button
      aria-label={copied ? "Copied" : label}
      className={className}
      onClick={copy}
      size="icon-xs"
      title={label}
      variant="ghost"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
};
