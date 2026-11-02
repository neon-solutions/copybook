import { CopybookMark } from "@/components/copybook-mark";

import { AgentsView } from "./agents-view";
import { DefinitionView } from "./definition-view";
import { useManifest } from "./manifest-store";
import { Sidebar } from "./sidebar";
import { useHashRoute } from "./use-hash-route";

export const App = () => {
  const { error, lastTest, manifest } = useManifest();
  const route = useHashRoute();

  if (!manifest) {
    return (
      <main className="text-muted-foreground grid min-h-svh place-items-center text-sm">
        {error ?? "Loading…"}
      </main>
    );
  }

  const agents = route.view === "agents";
  const selectedId = route.view === "definition" ? route.id : undefined;
  const selected = agents
    ? undefined
    : (manifest.definitions.find((entry) => entry.id === selectedId) ??
      manifest.definitions[0]);
  const errors = manifest.issues.filter((issue) => issue.level === "error");
  const warnings = manifest.issues.filter((issue) => issue.level === "warning");
  // Results change after a run started here, without a reload.
  const version = `${manifest.loadedAt}|${lastTest?.runId ?? ""}`;

  return (
    <div className="grid h-svh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <p className="font-heading flex items-center gap-2 font-semibold">
          <CopybookMark className="size-4.5" />
          <span>
            Copybook Studio{" "}
            <span className="text-muted-foreground font-normal">
              · {manifest.name}
            </span>
          </span>
        </p>
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {manifest.definitions.length} definitions
          {errors.length > 0 ? ` · ${errors.length} issues` : ""}
        </p>
      </header>
      <div className="grid min-h-0 grid-cols-[18rem_1fr]">
        <Sidebar
          agents={agents}
          entries={manifest.definitions}
          selected={selected?.id}
        />
        <main className="min-h-0 overflow-y-auto">
          {error ? (
            <p className="border-destructive/50 text-destructive border-b px-6 py-2 text-sm">
              {error}
            </p>
          ) : null}
          {errors.length > 0 ? (
            <ul className="text-destructive border-b px-6 py-2 text-sm">
              {errors.map((issue) => (
                <li key={`${issue.id}-${issue.message}`}>
                  {issue.id ? <code>{issue.id}</code> : null} {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="text-muted-foreground border-b px-6 py-2 text-sm">
              {warnings.map((issue) => (
                <li key={`${issue.id}-${issue.message}`}>
                  Warning: {issue.id ? <code>{issue.id}</code> : null}{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          {agents ? (
            <AgentsView version={version} {...(lastTest ? { lastTest } : {})} />
          ) : null}
          {selected ? (
            <DefinitionView
              entry={selected}
              key={selected.id}
              loadedAt={version}
            />
          ) : null}
          {agents || selected ? null : (
            <p className="text-muted-foreground p-6 text-sm">
              No definitions found. Check the content globs in your config.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};
