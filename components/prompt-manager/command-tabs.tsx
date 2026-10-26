"use client";

import { toText } from "@prompt-manager/core";
import type { Rendered } from "@prompt-manager/core";
import { useState } from "react";

import type { CopyEvent } from "@/components/prompt-manager/agent-prompt";
import { CopyButton } from "@/components/prompt-manager/copy-button";
import { AgentIcon, TerminalIcon } from "@/components/prompt-manager/icons";
import { RenderedText } from "@/components/prompt-manager/rendered-text";
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
  onCopy?: (event: CopyEvent) => void;
  /** Rendered in order, one tab each. */
  tabs: readonly CommandTab[];
}

/** Package-manager tabs for a command, optionally with an agent prompt tab. */
export const CommandTabs = ({ defaultTab, onCopy, tabs }: CommandTabsProps) => {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active);

  return (
    <div
      className="bg-card text-card-foreground border"
      data-pm-id={current?.rendered.id}
    >
      <Tabs onValueChange={(value) => setActive(String(value))} value={active}>
        <div className="flex items-center justify-between gap-2 border-b pr-1">
          <TabsList variant="line">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.kind === "prompt" ? <AgentIcon /> : null}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {current ? (
            <CopyButton
              label={current.kind === "prompt" ? "Copy prompt" : "Copy command"}
              onCopy={(text) => onCopy?.({ id: current.rendered.id, text })}
              value={toText(current.rendered)}
            />
          ) : null}
        </div>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {tab.kind === "prompt" ? (
              <pre className="max-h-48 overflow-y-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                <RenderedText rendered={tab.rendered} />
              </pre>
            ) : (
              <pre className="flex items-center gap-2 overflow-x-auto p-3 font-mono text-sm">
                <TerminalIcon className="text-muted-foreground shrink-0" />
                <code>
                  <RenderedText rendered={tab.rendered} />
                </code>
              </pre>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
