"use client";

import { toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";

import { CopyButton } from "@/components/copybook/copy-button";
import { AgentIcon, WarningIcon } from "@/components/copybook/icons";
import {
  containsSecret,
  RenderedText,
} from "@/components/copybook/rendered-text";

export interface CopyEvent {
  id: string;
  text: string;
  variant?: string;
}

interface AgentPromptProps {
  /** Fired after the prompt is copied, for analytics. */
  onCopy?: (event: CopyEvent) => void;
  rendered: Rendered;
  title?: string;
}

/** A prompt to paste into a coding agent, with a copy button. */
export const AgentPrompt = ({
  onCopy,
  rendered,
  title = "Agent prompt",
}: AgentPromptProps) => {
  const text = toText(rendered);
  const hasSecret = containsSecret(rendered);

  return (
    <figure
      className="bg-card text-card-foreground flex flex-col border"
      data-copybook-id={rendered.id}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-3 text-xs font-medium">
        <span className="flex items-center gap-2">
          <AgentIcon />
          {title}
        </span>
        <CopyButton
          label="Copy prompt"
          onCopy={(value) => onCopy?.({ id: rendered.id, text: value })}
          value={text}
        />
      </figcaption>
      <pre className="max-h-80 overflow-y-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        <RenderedText rendered={rendered} />
      </pre>
      {hasSecret ? (
        <p className="text-muted-foreground flex items-center gap-2 border-t px-3 py-2 text-xs">
          <WarningIcon />
          This prompt contains a secret. Only paste it into agents you trust.
        </p>
      ) : null}
    </figure>
  );
};
