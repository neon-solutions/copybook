"use client";

import { toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";
import { useState } from "react";

import { CopyButton } from "@/components/copybook/copy-button";
import { AgentIcon, WarningIcon } from "@/components/copybook/icons";
import { RenderedMarkdown } from "@/components/copybook/rendered-markdown";
import {
  containsSecret,
  RenderedText,
} from "@/components/copybook/rendered-text";
import { ViewToggle } from "@/components/copybook/view-toggle";
import type { PromptView } from "@/components/copybook/view-toggle";

export interface CopyEvent {
  id: string;
  text: string;
  variant?: string;
}

interface AgentPromptProps {
  /** The view shown first. `rendered` formats the prompt's Markdown. */
  defaultView?: PromptView;
  /** Fired after the prompt is copied, for analytics. */
  onCopy?: (event: CopyEvent) => void;
  rendered: Rendered;
  title?: string;
  /** Shows a switch between the formatted view and the Markdown. */
  viewToggle?: boolean;
}

/** A prompt to paste into a coding agent, with a copy button. */
export const AgentPrompt = ({
  defaultView = "source",
  onCopy,
  rendered,
  title = "Agent prompt",
  viewToggle = false,
}: AgentPromptProps) => {
  const [view, setView] = useState(defaultView);
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
        <span className="flex items-center gap-1">
          {viewToggle ? <ViewToggle onChange={setView} view={view} /> : null}
          <CopyButton
            label="Copy prompt"
            onCopy={(value) => onCopy?.({ id: rendered.id, text: value })}
            value={text}
          />
        </span>
      </figcaption>
      {view === "rendered" ? (
        <RenderedMarkdown
          className="max-h-80 overflow-y-auto p-3"
          rendered={rendered}
        />
      ) : (
        <pre className="max-h-80 overflow-y-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          <RenderedText rendered={rendered} />
        </pre>
      )}
      {hasSecret ? (
        <p className="text-muted-foreground flex items-center gap-2 border-t px-3 py-2 text-xs">
          <WarningIcon />
          This prompt contains a secret. Only paste it into agents you trust.
        </p>
      ) : null}
    </figure>
  );
};
