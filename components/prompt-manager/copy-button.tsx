"use client";

import { useEffect, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/prompt-manager/icons";
import { Button } from "@/components/ui/button";

const RESET_AFTER_MS = 2000;

interface CopyButtonProps {
  label?: string;
  onCopy?: (value: string) => void;
  value: string;
}

export const CopyButton = ({
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
      onClick={copy}
      size="icon-sm"
      title={label}
      variant="ghost"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
};
