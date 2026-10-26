import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SnapshotDot } from "./snapshot-badge";
import type { Entry } from "./types";
import { hrefFor } from "./use-hash-route";

const GROUPS = [
  { kind: "prompt", label: "Prompts" },
  { kind: "snippet", label: "Snippets" },
  { kind: "command", label: "Commands" },
] as const;

const matches = (entry: Entry, query: string) => {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  return [entry.id, entry.title ?? "", ...entry.placements, ...entry.tags].some(
    (value) => value.toLowerCase().includes(needle)
  );
};

interface SidebarProps {
  entries: readonly Entry[];
  selected?: string;
}

export const Sidebar = ({ entries, selected }: SidebarProps) => {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const visible = entries.filter((entry) => matches(entry, query));

  return (
    <nav
      aria-label="Definitions"
      className="flex min-h-0 flex-col gap-4 border-r p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={searchId}>Search</Label>
        <Input
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="id, title, placement, or tag"
          value={query}
        />
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {GROUPS.map((group) => {
          const items = visible.filter((entry) => entry.kind === group.kind);
          if (items.length === 0) {
            return null;
          }
          return (
            <section className="flex flex-col gap-1" key={group.kind}>
              <h2 className="text-muted-foreground px-2 text-xs font-semibold tracking-wider uppercase">
                {group.label}{" "}
                <span className="font-normal">({items.length})</span>
              </h2>
              <ul className="flex flex-col">
                {items.map((entry) => (
                  <li key={entry.id}>
                    <a
                      aria-current={entry.id === selected ? "page" : undefined}
                      className="hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:text-foreground flex items-center gap-2 px-2 py-1.5 font-mono text-xs"
                      href={hrefFor(entry.id)}
                    >
                      <SnapshotDot state={entry.snapshot} />
                      <span className="truncate">{entry.id}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 ? (
          <p className="text-muted-foreground px-2 text-sm">No matches.</p>
        ) : null}
      </div>
    </nav>
  );
};
