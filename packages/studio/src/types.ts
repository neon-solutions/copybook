import type { Rendered } from "@prompt-manager/core";

/** Mirrors the CLI's Studio API. Kept local so Studio doesn't depend on the CLI. */
export interface ParamInfo {
  default?: unknown;
  description?: string;
  example?: unknown;
  kind: "boolean" | "enum" | "number" | "schema" | "secret" | "string" | "url";
  optional: boolean;
  placeholder?: string;
  values?: string[];
}

export interface VariantInfo {
  deps?: { npm?: string[]; pip?: string[] };
  key: string;
  label: string;
  lang?: string;
}

export type SnapshotState = "changed" | "missing" | "up-to-date";

export interface Entry {
  aliases: string[];
  description?: string;
  embeds: string[];
  hash: string;
  id: string;
  kind: "command" | "prompt" | "snippet";
  owners: string[];
  params: Record<string, ParamInfo>;
  placements: string[];
  snapshot: SnapshotState;
  source: { export: string; file: string };
  tags: string[];
  title?: string;
  usedBy: string[];
  variants?: VariantInfo[];
}

export interface Issue {
  id?: string;
  level: "error" | "warning";
  message: string;
}

export interface StudioManifest {
  definitions: Entry[];
  issues: Issue[];
  loadedAt: string;
  name: string;
}

export interface Commit {
  author: string;
  date: string;
  hash: string;
  subject: string;
}

export interface RenderResult {
  rendered: Rendered;
  text: string;
}
