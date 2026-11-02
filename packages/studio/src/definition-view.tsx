import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { fetchDefinitionMarkdown } from "./api";
import { History } from "./history";
import { initialValues, ParamsForm, toParamValues } from "./params-form";
import { Preview } from "./preview";
import { TestResults } from "./results";
import { SnapshotBadge } from "./snapshot-badge";
import type { Entry } from "./types";
import { hrefFor } from "./use-hash-route";

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
      {title}
    </h2>
    {children}
  </section>
);

const IdLinks = ({ empty, ids }: { empty: string; ids: readonly string[] }) =>
  ids.length === 0 ? (
    <p className="text-muted-foreground text-sm">{empty}</p>
  ) : (
    <ul className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <li key={id}>
          <a
            className="hover:bg-muted border px-2 py-1 font-mono text-xs"
            href={hrefFor(id)}
          >
            {id}
          </a>
        </li>
      ))}
    </ul>
  );

const COPY_LABELS = {
  copied: "Copied",
  failed: "Couldn't copy",
  idle: "Copy for agent",
} as const;

const RESET_AFTER_MS = 2000;

/** Copies the definition as Markdown, to hand to a coding agent. */
const CopyForAgent = ({ id }: { id: string }) => {
  const [state, setState] = useState<keyof typeof COPY_LABELS>("idle");

  useEffect(() => {
    if (state === "idle") {
      return;
    }
    const timeout = setTimeout(() => setState("idle"), RESET_AFTER_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await fetchDefinitionMarkdown(id));
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <Button onClick={copy} size="xs" variant="outline">
      <span aria-live="polite">{COPY_LABELS[state]}</span>
    </Button>
  );
};

interface DefinitionViewProps {
  entry: Entry;
  loadedAt: string;
}

export const DefinitionView = ({ entry, loadedAt }: DefinitionViewProps) => {
  const [values, setValues] = useState(() => initialValues(entry.params));

  return (
    <article className="flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {entry.kind}
        </p>
        <h1 className="font-mono text-xl font-semibold break-all">
          {entry.id}
        </h1>
        {entry.title ? <p className="text-base">{entry.title}</p> : null}
        {entry.description ? (
          <p className="text-muted-foreground text-sm">{entry.description}</p>
        ) : null}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <SnapshotBadge state={entry.snapshot} />
          <span>
            <code>
              {entry.source.file}#{entry.source.export}
            </code>
          </span>
          {entry.aliases.length > 0 ? (
            <span>Was: {entry.aliases.join(", ")}</span>
          ) : null}
          <CopyForAgent id={entry.id} />
        </div>
      </header>

      <Section title="Where it's shown">
        <div className="flex flex-col gap-3">
          {entry.placements.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No placements declared.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {entry.placements.map((placement) => (
                <li
                  className="bg-muted px-2 py-1 font-mono text-xs"
                  key={placement}
                >
                  {placement}
                </li>
              ))}
            </ul>
          )}
          {entry.renderedIn.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">Rendered in</p>
              <ul className="flex flex-col gap-1">
                {entry.renderedIn.map((file) => (
                  <li className="font-mono text-xs" key={file}>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Params">
        <ParamsForm
          onChange={setValues}
          params={entry.params}
          values={values}
        />
      </Section>

      <Section title="Preview">
        <Preview entry={entry} values={toParamValues(entry.params, values)} />
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="Embeds">
          <IdLinks empty="Embeds no other definitions." ids={entry.embeds} />
        </Section>
        <Section title="Used by">
          <IdLinks empty="Not embedded anywhere." ids={entry.usedBy} />
        </Section>
      </div>

      <Section title="Tests and evals">
        <TestResults id={entry.id} loadedAt={loadedAt} />
      </Section>

      <Section title="History">
        <History id={entry.id} loadedAt={loadedAt} />
      </Section>
    </article>
  );
};
