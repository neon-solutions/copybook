"use client";

import { toText } from "@copybook/core";
import type { Rendered } from "@copybook/core";
import { useState } from "react";

import type { CopyEvent } from "@/components/copybook/agent-prompt";
import { CopyButton } from "@/components/copybook/copy-button";
import { AgentIcon, TerminalIcon } from "@/components/copybook/icons";
import { RenderedMarkdown } from "@/components/copybook/rendered-markdown";
import { RenderedText } from "@/components/copybook/rendered-text";
import { ViewToggle } from "@/components/copybook/view-toggle";
import type { PromptView } from "@/components/copybook/view-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CommandTab {
  id: string;
  /** `prompt` tabs get an agent icon and wrap long lines. */
  kind?: "command" | "prompt";
  label: string;
  rendered: Rendered;
}

interface CommandTabsProps {
  defaultTab?: string;
  /** The view prompt tabs show first. `rendered` formats their Markdown. */
  defaultView?: PromptView;
  onCopy?: (event: CopyEvent) => void;
  /** Rendered in order, one tab each. */
  tabs: readonly CommandTab[];
  /** Shows a switch between formatted and Markdown views on prompt tabs. */
  viewToggle?: boolean;
}

const TabBody = ({ tab, view }: { tab: CommandTab; view: PromptView }) => {
  if (tab.kind !== "prompt") {
    return (
      <pre className="flex items-center gap-2 overflow-x-auto p-3 font-mono text-sm">
        <TerminalIcon className="text-muted-foreground shrink-0" />
        <code>
          <RenderedText rendered={tab.rendered} />
        </code>
      </pre>
    );
  }
  if (view === "rendered") {
    return (
      <RenderedMarkdown
        className="max-h-48 overflow-y-auto p-3"
        rendered={tab.rendered}
      />
    );
  }
  return (
    <pre className="max-h-48 overflow-y-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
      <RenderedText rendered={tab.rendered} />
    </pre>
  );
};

/** Package-manager tabs for a command, optionally with an agent prompt tab. */
export const CommandTabs = ({
  defaultTab,
  defaultView = "source",
  onCopy,
  tabs,
  viewToggle = false,
}: CommandTabsProps) => {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const [view, setView] = useState(defaultView);
  const current = tabs.find((tab) => tab.id === active);
  const isPrompt = current?.kind === "prompt";

  return (
    <div
      className="bg-card text-card-foreground border"
      data-copybook-id={current?.rendered.id}
    >
      <Tabs onValueChange={(value) => setActive(String(value))} value={active}>
        <div className="flex items-center justify-between gap-2 border-b pr-1">
          <div className="min-w-0 overflow-x-auto">
            <TabsList variant="line">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.kind === "prompt" ? <AgentIcon /> : null}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {current ? (
            <span className="flex shrink-0 items-center gap-1">
              {viewToggle && isPrompt ? (
                <ViewToggle onChange={setView} view={view} />
              ) : null}
              <CopyButton
                label={isPrompt ? "Copy prompt" : "Copy command"}
                onCopy={(text) => onCopy?.({ id: current.rendered.id, text })}
                value={toText(current.rendered)}
              />
            </span>
          ) : null}
        </div>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <TabBody tab={tab} view={view} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
