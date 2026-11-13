import type { Rendered } from "@copybook/core";
import { useEffect, useState } from "react";

import { AgentPrompt } from "@/components/copybook/agent-prompt";
import { CodeVariants } from "@/components/copybook/code-variants";

import { renderDefinition } from "./api";
import type { Entry } from "./types";

const RENDER_DEBOUNCE_MS = 150;

interface Rendering {
  error?: string;
  items: { key: string; label: string; rendered: Rendered }[];
}

/** Renders every variant with the current values, debounced. */
const useRendering = (entry: Entry, values: Record<string, unknown>) => {
  const [state, setState] = useState<Rendering>({ items: [] });
  const serialized = JSON.stringify(values);

  useEffect(() => {
    let cancelled = false;
    const variants = entry.variants ?? [
      { key: "", label: entry.kind === "command" ? "Command" : "Code" },
    ];
    const timeout = setTimeout(async () => {
      try {
        const parsed = JSON.parse(serialized) as Record<string, unknown>;
        const results = await Promise.all(
          variants.map((variant) =>
            renderDefinition(
              entry.id,
              parsed,
              variant.key === "" ? undefined : variant.key
            )
          )
        );
        if (!cancelled) {
          setState({
            items: results.map((result, index) => ({
              key: variants[index]?.key || "default",
              label: variants[index]?.label || "Code",
              rendered: result.rendered,
            })),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            error: error instanceof Error ? error.message : String(error),
            items: [],
          });
        }
      }
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [entry, serialized]);

  return state;
};

export const Preview = ({
  entry,
  values,
}: {
  entry: Entry;
  values: Record<string, unknown>;
}) => {
  const { error, items } = useRendering(entry, values);
  const [first] = items;

  if (error) {
    return (
      <p className="border-destructive/50 text-destructive border p-3 text-sm">
        {error}
      </p>
    );
  }
  if (!first) {
    return <p className="text-muted-foreground text-sm">Rendering…</p>;
  }
  if (entry.kind === "prompt") {
    return (
      <AgentPrompt
        openIn={["cursor", "claude-code", "codex"]}
        rendered={first.rendered}
        viewToggle
      />
    );
  }
  return <CodeVariants items={items} />;
};
