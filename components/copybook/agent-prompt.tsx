"use client";

import { toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";
import { useState } from "react";

import type { AgentId } from "@/components/copybook/agent-links";
import { CopyButton } from "@/components/copybook/copy-button";
import { AgentIcon, WarningIcon } from "@/components/copybook/icons";
import { OpenInAgent } from "@/components/copybook/open-in-agent";
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

export interface OpenEvent {
  agent: AgentId;
  id: string;
  text: string;
}

interface AgentPromptProps {
  /** The view shown first. `rendered` formats the prompt's Markdown. */
  defaultView?: PromptView;
  /** Fired after the prompt is copied, for analytics. */
  onCopy?: (event: CopyEvent) => void;
  /** Fired when an `openIn` link is followed, for analytics. */
  onOpen?: (event: OpenEvent) => void;
  /**
   * Agents to offer links for, which open the prompt pre-filled and unsent.
   * Prompts with a real secret only copy, so the secret stays out of URLs.
   */
  openIn?: readonly AgentId[];
  rendered: Rendered;
  title?: string;
  /** Shows a switch between the formatted view and the Markdown. */
  viewToggle?: boolean;
}

const NO_AGENTS: readonly AgentId[] = [];

/** A prompt to paste into a coding agent, with a copy button. */
export const AgentPrompt = ({
  defaultView = "source",
  onCopy,
  onOpen,
  openIn = NO_AGENTS,
  rendered,
  title = "Agent prompt",
  viewToggle = false,
}: AgentPromptProps) => {
  const [view, setView] = useState(defaultView);
  const text = toText(rendered);
  const hasSecret = containsSecret(rendered);
  const showLinks = openIn.length > 0 && !hasSecret;

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
      {showLinks ? (
        <OpenInAgent
          agents={openIn}
          onOpen={(agent) => onOpen?.({ agent, id: rendered.id, text })}
          text={text}
        />
      ) : null}
      {hasSecret ? (
        <p className="text-muted-foreground flex items-center gap-2 border-t px-3 py-2 text-xs">
          <WarningIcon />
          This prompt contains a secret. Only paste it into agents you trust.
        </p>
      ) : null}
    </figure>
  );
};
