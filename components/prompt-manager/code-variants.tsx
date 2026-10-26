"use client";

import { toText } from "@prompt-manager/core";
import type { Rendered } from "@prompt-manager/core";
import { useState } from "react";

import type { CopyEvent } from "@/components/prompt-manager/agent-prompt";
import { CopyButton } from "@/components/prompt-manager/copy-button";
import { RenderedText } from "@/components/prompt-manager/rendered-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface CodeVariant {
  key: string;
  label: string;
  rendered: Rendered;
}

interface CodeVariantsProps {
  defaultKey?: string;
  /** Rendered in order, one tab each. */
  items: readonly CodeVariant[];
  onCopy?: (event: CopyEvent) => void;
}

/**
 * One snippet in several frameworks or setups. Render every variant on the
 * server with `listVariants` and `render`, then pass them here.
 */
export const CodeVariants = ({
  defaultKey,
  items,
  onCopy,
}: CodeVariantsProps) => {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key ?? "");
  const current = items.find((item) => item.key === active);

  return (
    <div
      className="bg-card text-card-foreground border"
      data-pm-id={current?.rendered.id}
      data-pm-variant={current?.rendered.variant}
    >
      <Tabs onValueChange={(value) => setActive(String(value))} value={active}>
        <div className="flex items-center justify-between gap-2 border-b pr-1">
          <TabsList variant="line">
            {items.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {current ? (
            <CopyButton
              label="Copy snippet"
              onCopy={(text) =>
                onCopy?.({
                  id: current.rendered.id,
                  text,
                  ...(current.rendered.variant
                    ? { variant: current.rendered.variant }
                    : {}),
                })
              }
              value={toText(current.rendered)}
            />
          ) : null}
        </div>
        {items.map((item) => (
          <TabsContent key={item.key} value={item.key}>
            <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
              <code data-lang={item.rendered.lang}>
                <RenderedText rendered={item.rendered} />
              </code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
