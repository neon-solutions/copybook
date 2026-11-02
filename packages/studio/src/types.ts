import type { Rendered } from "@copybook/core";

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
  renderedIn: string[];
  snapshot: SnapshotState;
  source: { export: string; file: string };
  tags: string[];
  title?: string;
  usedBy: string[];
  variants?: VariantInfo[];
}

export interface Issue {
  code?: string;
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

export interface TestResult {
  durationMs: number;
  id: string;
  label?: string;
  message?: string;
  status: "fail" | "pass" | "skip";
  tier: "run" | "syntax" | "typecheck";
  variant?: string;
}

export interface EvalResult {
  agent: string;
  agentVersion: string;
  costUsd: number;
  id: string;
  passRate: number;
  reason?: string;
  status: "cached" | "fail" | "pass" | "skip";
  threshold: number;
  trials: { passed: boolean; trial: number }[];
}

export interface Results {
  eval?: { finishedAt: string; results: EvalResult[] };
  test?: { finishedAt: string; results: TestResult[] };
}
