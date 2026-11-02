import type {
  CommandCatalog,
  Commit,
  RenderResult,
  Results,
  StatusReport,
  StudioManifest,
  TestDone,
} from "./types";

interface ApiError {
  error?: { code: string; message: string };
}

const getJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & ApiError;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `${response.status} ${response.statusText}`
    );
  }
  return body;
};

export const fetchManifest = () => getJson<StudioManifest>("api/manifest");

/** `version` changes on every reload, so new reports show up. */
export const fetchResults = (version: string) =>
  getJson<Results>(`api/results?v=${encodeURIComponent(version)}`);

/** `version` changes on every reload, so new commits show up. */
export const fetchHistory = (id: string, version: string) =>
  getJson<Commit[]>(
    `api/history?id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`
  );

export const renderDefinition = (
  id: string,
  values: Record<string, unknown>,
  variant?: string
) =>
  getJson<RenderResult>("api/render", {
    body: JSON.stringify({ id, values, variant }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

const postJson = <T>(url: string, body: unknown) =>
  getJson<T>(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

/** `version` changes on every reload, so the status stays current. */
export const fetchStatus = (version: string) =>
  getJson<StatusReport>(`api/status?v=${encodeURIComponent(version)}`);

export const fetchCommands = () => getJson<CommandCatalog>("api/commands");

/** A definition as Markdown, for "Copy for agent". */
export const fetchDefinitionMarkdown = async (id: string) => {
  const response = await fetch(`api/definitions/${encodeURIComponent(id)}.md`);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
};

export const writeSnapshots = () =>
  postJson<{ written: { added: string[]; updated: string[] } }>(
    "api/snapshot",
    {}
  );

/** Starts the syntax and typecheck tests; `test-done` follows. */
export const startTests = (ids?: readonly string[]) =>
  postJson<{ runId: string }>("api/test", ids ? { ids } : {});

interface Handlers {
  onChange: () => void;
  onError: (message: string) => void;
  onTestDone: (done: TestDone) => void;
}

const dataOf = <T>(event: Event) =>
  event instanceof MessageEvent
    ? (JSON.parse(String(event.data)) as T)
    : undefined;

/** Follows the CLI's events: reloads, reload errors, and test runs. */
export const subscribe = ({ onChange, onError, onTestDone }: Handlers) => {
  const source = new EventSource("api/events");
  source.addEventListener("change", onChange);
  source.addEventListener("error", (event) => {
    const data = dataOf<{ message: string }>(event);
    if (data) {
      onError(data.message);
    }
  });
  source.addEventListener("test-error", (event) => {
    const data = dataOf<{ message: string }>(event);
    if (data) {
      onError(data.message);
    }
  });
  source.addEventListener("test-done", (event) => {
    const data = dataOf<TestDone>(event);
    if (data) {
      onTestDone(data);
    }
  });
  return () => source.close();
};
