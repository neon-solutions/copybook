import { DefinitionView } from "./definition-view";
import { useManifest } from "./manifest-store";
import { Sidebar } from "./sidebar";
import { useHashRoute } from "./use-hash-route";

export const App = () => {
  const { error, manifest } = useManifest();
  const selectedId = useHashRoute();

  if (!manifest) {
    return (
      <main className="text-muted-foreground grid min-h-svh place-items-center text-sm">
        {error ?? "Loading…"}
      </main>
    );
  }

  const selected =
    manifest.definitions.find((entry) => entry.id === selectedId) ??
    manifest.definitions[0];
  const errors = manifest.issues.filter((issue) => issue.level === "error");

  return (
    <div className="grid h-svh grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <p className="font-heading font-semibold">
          Prompt Manager Studio{" "}
          <span className="text-muted-foreground font-normal">
            · {manifest.name}
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          {manifest.definitions.length} definitions
          {errors.length > 0 ? ` · ${errors.length} issues` : ""}
        </p>
      </header>
      <div className="grid min-h-0 grid-cols-[18rem_1fr]">
        <Sidebar entries={manifest.definitions} selected={selected?.id} />
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
          {selected ? (
            <DefinitionView
              entry={selected}
              key={selected.id}
              loadedAt={manifest.loadedAt}
            />
          ) : (
            <p className="text-muted-foreground p-6 text-sm">
              No definitions found. Check the content globs in your config.
            </p>
          )}
        </main>
      </div>
    </div>
  );
};
