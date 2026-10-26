"use client";

import { RobotIcon, TerminalIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CommandTab {
  id: string;
  /** `prompt` tabs get a robot icon and wrap long text. */
  kind?: "command" | "prompt";
  /** Shown in the tab trigger. */
  label: string;
  value: string;
}

interface CommandTabsProps {
  defaultTab?: string;
  /** Rendered in order. */
  tabs: readonly CommandTab[];
}

/** Package-manager style tabs with a copy button. */
export const CommandTabs = ({ defaultTab, tabs }: CommandTabsProps) => {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((tab) => tab.id === active);

  return (
    <div className="bg-card border">
      <Tabs onValueChange={(value) => setActive(String(value))} value={active}>
        <div className="flex items-center justify-between gap-2 border-b pr-2">
          <TabsList variant="line">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.kind === "prompt" ? (
                  <RobotIcon data-icon="inline-start" />
                ) : null}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {current ? (
            <CopyButton
              label={current.kind === "prompt" ? "Copy prompt" : "Copy command"}
              value={current.value}
            />
          ) : null}
        </div>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <div className="px-4 pt-2 pb-4">
              {tab.kind === "prompt" ? (
                <pre className="text-muted-foreground max-h-48 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {tab.value}
                </pre>
              ) : (
                <pre className="flex items-center gap-2 overflow-x-auto font-mono text-sm">
                  <TerminalIcon
                    aria-hidden="true"
                    className="text-muted-foreground shrink-0"
                  />
                  <code>{tab.value}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
