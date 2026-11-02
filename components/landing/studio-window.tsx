"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

import { AgentPrompt } from "@/components/copybook/agent-prompt";
import { CodeVariants } from "@/components/copybook/code-variants";
import {
  checksFor,
  EMBEDS,
  ENTRIES,
  initialValues,
  paramInfo,
  renderPreview,
  toParamValues,
  usedBy,
} from "@/components/landing/studio-data";
import type { ParamInfo, StudioEntry } from "@/components/landing/studio-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type Definition = StudioEntry["definition"];
type Select = (id: string) => void;

/** A server-rendered panel that sits next to the definitions. */
export interface StudioView {
  id: string;
  label: string;
  panel: ReactNode;
}

/** Element ids for a sidebar item and the panel it controls. */
interface Ids {
  button: (id: string) => string;
  panel: (id: string) => string;
}

const GROUPS = [
  { kind: "prompt", label: "Prompts" },
  { kind: "snippet", label: "Snippets" },
  { kind: "command", label: "Commands" },
] as const;

const matches = ({ definition }: StudioEntry, query: string) => {
  const needle = query.trim().toLowerCase();
  return [
    definition.id,
    definition.title ?? "",
    ...(definition.placements ?? []),
  ].some((value) => value.toLowerCase().includes(needle));
};

/** Every committed snapshot matches its definition; CI checks that. */
const SnapshotDot = () => (
  <span
    aria-hidden="true"
    className="bg-brand-neon inline-block size-2 shrink-0 rounded-full"
  />
);

const itemClass =
  "text-muted-foreground hover:bg-muted hover:text-foreground aria-[current]:bg-muted aria-[current]:text-foreground focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2";

const Sidebar = ({
  ids,
  onSelect,
  selected,
  views,
}: {
  ids: Ids;
  onSelect: Select;
  selected: string;
  views: readonly StudioView[];
}) => {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const visible = ENTRIES.filter((entry) => matches(entry, query));

  return (
    <nav
      aria-label="Acme definitions"
      className="border-border flex max-h-64 shrink-0 flex-col gap-4 border-b p-4 md:max-h-none md:w-72 md:border-r md:border-b-0"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={searchId}>Search</Label>
        <Input
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="id, title, or placement"
          value={query}
        />
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {GROUPS.map((group) => {
          const items = visible.filter(
            ({ definition }) => definition.kind === group.kind
          );
          return items.length === 0 ? null : (
            <section className="flex flex-col gap-1" key={group.kind}>
              <h4 className="eyebrow px-2">
                {group.label} ({items.length})
              </h4>
              <ul className="flex flex-col">
                {items.map(({ definition }) => (
                  <li key={definition.id}>
                    <button
                      aria-controls={ids.panel(definition.id)}
                      aria-current={
                        definition.id === selected ? "true" : undefined
                      }
                      className={`${itemClass} font-mono`}
                      id={ids.button(definition.id)}
                      onClick={() => onSelect(definition.id)}
                      type="button"
                    >
                      <SnapshotDot />
                      <span className="truncate">{definition.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {visible.length === 0 ? (
          <p className="text-muted-foreground px-2 text-sm">No matches.</p>
        ) : null}
        {views.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h4 className="eyebrow px-2">Project</h4>
            <ul className="flex flex-col">
              {views.map((view) => (
                <li key={view.id}>
                  <button
                    aria-controls={ids.panel(view.id)}
                    aria-current={view.id === selected ? "true" : undefined}
                    className={itemClass}
                    id={ids.button(view.id)}
                    onClick={() => onSelect(view.id)}
                    type="button"
                  >
                    {view.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </nav>
  );
};

const Section = ({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-3">
    <h4 className="eyebrow">{title}</h4>
    {children}
  </section>
);

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="bg-muted text-foreground rounded-sm px-2 py-1 font-mono text-xs">
    {children}
  </span>
);

const ParamField = ({
  name,
  onChange,
  param,
  value,
}: {
  name: string;
  onChange: (value: string) => void;
  param: ParamInfo;
  value: string;
}) => {
  const id = useId();
  const options =
    param.kind === "boolean" ? ["true", "false"] : (param.values ?? []);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        <span className="font-mono">{name}</span>
        <span className="text-muted-foreground font-normal">
          {param.kind}
          {param.optional ? ", optional" : ""}
        </span>
      </Label>
      {options.length > 0 ? (
        <NativeSelect
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={param.placeholder}
          type={param.kind === "secret" ? "password" : "text"}
          value={value}
        />
      )}
    </div>
  );
};

/** Renders outside the component, so a bad value shows as a message. */
const tryRender = (definition: Definition, values: Record<string, unknown>) => {
  try {
    return { items: renderPreview(definition, values) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const Preview = ({
  definition,
  values,
}: {
  definition: Definition;
  values: Record<string, unknown>;
}) => {
  const result = tryRender(definition, values);
  if ("error" in result) {
    return (
      <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
        {result.error}
      </p>
    );
  }
  const [first] = result.items;
  if (definition.kind === "prompt" && first) {
    return <AgentPrompt rendered={first.rendered} />;
  }
  return <CodeVariants items={result.items} />;
};

const IdLinks = ({
  empty,
  ids,
  onSelect,
}: {
  empty: string;
  ids: readonly string[];
  onSelect: Select;
}) =>
  ids.length === 0 ? (
    <p className="text-muted-foreground text-sm">{empty}</p>
  ) : (
    <ul className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <li key={id}>
          <button
            className="border-border hover:bg-muted focus-visible:ring-ring/50 rounded-sm border px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2"
            onClick={() => onSelect(id)}
            type="button"
          >
            {id}
          </button>
        </li>
      ))}
    </ul>
  );

const NO_VIEWS: readonly StudioView[] = [];

const panelClass = "flex min-w-0 flex-1 flex-col gap-7 overflow-y-auto p-6";

const DefinitionPanel = ({
  entry,
  hidden,
  ids,
  onSelect,
}: {
  entry: StudioEntry;
  hidden: boolean;
  ids: Ids;
  onSelect: Select;
}) => {
  const { definition } = entry;
  const params = paramInfo(definition);
  const [values, setValues] = useState(() => initialValues(params));
  const names = Object.keys(params);
  const placements = definition.placements ?? [];

  return (
    <article
      aria-labelledby={ids.button(definition.id)}
      className={panelClass}
      hidden={hidden}
      id={ids.panel(definition.id)}
    >
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{definition.kind}</p>
        <h3 className="text-foreground font-mono text-lg font-semibold break-all">
          {definition.id}
        </h3>
        {definition.title ? (
          <p className="text-body text-foreground">{definition.title}</p>
        ) : null}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-2">
            <SnapshotDot />
            Snapshot committed
          </span>
          <code className="font-mono">{entry.source}</code>
        </div>
      </header>

      <Section title="Where it's shown">
        {placements.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No placements declared.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {placements.map((placement) => (
              <Chip key={placement}>{placement}</Chip>
            ))}
          </div>
        )}
      </Section>

      <Section title="Params">
        {names.length === 0 ? (
          <p className="text-muted-foreground text-sm">No params.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {names.map((name) => {
              const param = params[name];
              return param ? (
                <ParamField
                  key={name}
                  name={name}
                  onChange={(value) => setValues({ ...values, [name]: value })}
                  param={param}
                  value={values[name] ?? ""}
                />
              ) : null;
            })}
          </div>
        )}
      </Section>

      <Section title="Preview">
        <Preview
          definition={definition}
          values={toParamValues(params, values)}
        />
      </Section>

      <div className="grid gap-7 sm:grid-cols-2">
        <Section title="Embeds">
          <IdLinks
            empty="Embeds no other definitions."
            ids={EMBEDS.get(definition.id) ?? []}
            onSelect={onSelect}
          />
        </Section>
        <Section title="Used by">
          <IdLinks
            empty="Not embedded anywhere."
            ids={usedBy(definition.id)}
            onSelect={onSelect}
          />
        </Section>
      </div>

      <Section title="Tests and evals">
        <ul className="divide-border border-border divide-y rounded-md border">
          {checksFor(definition).map((row) => (
            <li
              className="flex items-center justify-between gap-4 px-3 py-2 text-xs"
              key={row.label}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <Chip>{row.check}</Chip>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Results and history appear here after <code>copybook test</code> and{" "}
          <code>copybook eval</code> run.
        </p>
      </Section>
    </article>
  );
};

/**
 * Copybook Studio in a window: the Acme example's real definitions, with
 * live params, rendered through the registry components. Every panel is in
 * the server HTML, so agents that read the page see all of them; the
 * inactive ones are `hidden`.
 */
export const StudioWindow = ({
  views = NO_VIEWS,
}: {
  views?: readonly StudioView[];
}) => {
  const [selected, setSelected] = useState(ENTRIES[0]?.definition.id ?? "");
  const base = useId();
  const ids: Ids = {
    button: (id) => `${base}-item-${id}`,
    panel: (id) => `${base}-panel-${id}`,
  };

  return (
    <div className="bg-card text-card-foreground shadow-window overflow-hidden rounded-xl">
      <div className="border-border flex items-center gap-3 border-b px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="bg-border size-2.5 rounded-full" />
          <span className="bg-border size-2.5 rounded-full" />
          <span className="bg-border size-2.5 rounded-full" />
        </span>
        <span className="bg-muted text-muted-foreground mx-auto rounded-md px-3 py-1 font-mono text-xs">
          127.0.0.1:4983
        </span>
        <span aria-hidden="true" className="w-12" />
      </div>
      <div className="border-border flex items-center justify-between gap-4 border-b px-4 py-3">
        <p className="text-foreground text-sm font-semibold">
          Copybook Studio{" "}
          <span className="text-muted-foreground font-normal">acme</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {ENTRIES.length} definitions
        </p>
      </div>
      <div className="flex flex-col md:h-160 md:flex-row">
        <Sidebar
          ids={ids}
          onSelect={setSelected}
          selected={selected}
          views={views}
        />
        {ENTRIES.map((entry) => (
          <DefinitionPanel
            entry={entry}
            hidden={entry.definition.id !== selected}
            ids={ids}
            key={entry.definition.id}
            onSelect={setSelected}
          />
        ))}
        {views.map((view) => (
          <section
            aria-labelledby={ids.button(view.id)}
            className={panelClass}
            hidden={view.id !== selected}
            id={ids.panel(view.id)}
            key={view.id}
          >
            {view.panel}
          </section>
        ))}
      </div>
    </div>
  );
};
