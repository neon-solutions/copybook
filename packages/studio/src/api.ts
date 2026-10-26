import type { Commit, RenderResult, Results, StudioManifest } from "./types";

const getJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `${response.status} ${response.statusText}`);
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

/** Calls `onChange` whenever the CLI reloads content. */
export const subscribe = (
  onChange: () => void,
  onError: (message: string) => void
) => {
  const source = new EventSource("api/events");
  source.addEventListener("change", onChange);
  source.addEventListener("error", (event) => {
    if (event instanceof MessageEvent) {
      onError((JSON.parse(String(event.data)) as { message: string }).message);
    }
  });
  return () => source.close();
};
