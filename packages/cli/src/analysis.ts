import { removedWithoutAlias } from "./changes";
import { loadProject } from "./load";
import type { LoadedDefinition, Project } from "./load";
import { buildManifest } from "./manifest";
import type { ManifestEntry } from "./manifest";
import { compareSnapshots } from "./snapshot";
import type { Snapshot, SnapshotStatus } from "./snapshot";
import { findUsages } from "./usages";
import type { UsageReport } from "./usages";
import { buildSnapshots } from "./validate";
import type { Issue } from "./validate";

export type SnapshotState = "changed" | "missing" | "up-to-date";

/** A manifest entry plus what Studio, `status`, and agents need to know. */
export interface DefinitionEntry extends ManifestEntry {
  /** Product files that render it, when `usage` is configured. */
  renderedIn: string[];
  snapshot: SnapshotState;
  /** Ids of definitions that embed this one. */
  usedBy: string[];
}

/** Everything `check`, `status`, Studio, and the MCP server report on. */
export interface Analysis {
  entries: DefinitionEntry[];
  /** Validation issues: placements, aliases, and render failures. */
  issues: Issue[];
  loadedAt: string;
  project: Project;
  snapshots: Snapshot[];
  status: SnapshotStatus;
  usage?: UsageReport;
}

export const embedsOf = (snapshots: readonly Snapshot[]) =>
  new Map(snapshots.map((snapshot) => [snapshot.id, snapshot.embeds]));

const reverseEmbeds = (entries: readonly ManifestEntry[]) => {
  const usedBy = new Map<string, string[]>();
  for (const entry of entries) {
    for (const embedded of entry.embeds) {
      usedBy.set(embedded, [...(usedBy.get(embedded) ?? []), entry.id]);
    }
  }
  return usedBy;
};

/** Renders, validates, and compares every definition of a loaded project. */
export const analyzeProject = async (project: Project): Promise<Analysis> => {
  const { issues, snapshots } = buildSnapshots(project);
  const [status, usage] = await Promise.all([
    compareSnapshots(project.config, snapshots),
    findUsages(project, embedsOf(snapshots)),
  ]);
  const missing = new Set(status.missing);
  const changed = new Set(status.changed.map((change) => change.id));
  const { definitions } = buildManifest(project.definitions, snapshots);
  const usedBy = reverseEmbeds(definitions);

  const snapshotState = (id: string): SnapshotState => {
    if (missing.has(id)) {
      return "missing";
    }
    return changed.has(id) ? "changed" : "up-to-date";
  };

  return {
    entries: definitions.map((entry) => ({
      ...entry,
      renderedIn: usage?.usages[entry.id] ?? [],
      snapshot: snapshotState(entry.id),
      usedBy: usedBy.get(entry.id) ?? [],
    })),
    issues,
    loadedAt: new Date().toISOString(),
    project,
    snapshots,
    status,
    ...(usage ? { usage } : {}),
  };
};

export const loadAnalysis = async (
  cwd: string,
  options: { config?: string } = {}
) => analyzeProject(await loadProject(cwd, options));

/**
 * Every problem `check` reports: validation, missing, stale, and orphaned
 * snapshots, unused definitions, and, with `base`, ids removed since then
 * without an alias.
 */
export const checkIssues = async (
  analysis: Analysis,
  options: { base?: string } = {}
): Promise<Issue[]> => {
  const { status } = analysis;
  const issues: Issue[] = [...analysis.issues];
  for (const id of status.missing) {
    issues.push({
      code: "snapshot-missing",
      id,
      level: "error",
      message: "Has no snapshot.",
    });
  }
  for (const id of status.orphaned) {
    issues.push({
      code: "snapshot-orphaned",
      id,
      level: "error",
      message: "Has a snapshot but no definition.",
    });
  }
  for (const change of status.changed) {
    issues.push({
      code: "snapshot-changed",
      id: change.id,
      level: "error",
      message: "Snapshot is out of date.",
    });
  }
  for (const id of analysis.usage?.unused ?? []) {
    issues.push({
      code: "unused",
      id,
      level: "warning",
      message:
        "Isn't rendered by any file in usage.include, directly or through an embed.",
    });
  }
  if (options.base) {
    for (const id of await removedWithoutAlias(
      analysis.project,
      options.base
    )) {
      issues.push({
        code: "removed-without-alias",
        id,
        level: "warning",
        message: `Removed since ${options.base}. If it was renamed, add "${id}" to the new definition's aliases.`,
      });
    }
  }
  return issues;
};

export interface FoundDefinition {
  entry: DefinitionEntry;
  loaded: LoadedDefinition;
  /** Set when `id` matched one of the definition's aliases. */
  via?: "alias";
}

/** Finds a definition by id, or by an alias it kept after a rename. */
export const findDefinition = (
  analysis: Analysis,
  id: string
): FoundDefinition | undefined => {
  const match = (alias: boolean) =>
    analysis.project.definitions.find(({ definition }) =>
      alias ? (definition.aliases ?? []).includes(id) : definition.id === id
    );
  const loaded = match(false) ?? match(true);
  const entry = analysis.entries.find(
    (candidate) => candidate.id === loaded?.definition.id
  );
  if (!(loaded && entry)) {
    return undefined;
  }
  return loaded.definition.id === id
    ? { entry, loaded }
    : { entry, loaded, via: "alias" };
};

const editDistance = (left: string, right: string) => {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (const [row, leftChar] of [...left].entries()) {
    const current = [row + 1];
    for (const [column, rightChar] of [...right].entries()) {
      current.push(
        Math.min(
          (previous[column + 1] ?? 0) + 1,
          (current[column] ?? 0) + 1,
          (previous[column] ?? 0) + (leftChar === rightChar ? 0 : 1)
        )
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
};

const MAX_SUGGESTIONS = 3;

/** Ids close to `id`, for "did you mean" hints. */
export const suggestIds = (analysis: Analysis, id: string): string[] => {
  const needle = id.toLowerCase();
  const threshold = Math.max(2, Math.floor(id.length / 3));
  return analysis.entries
    .map((entry) => ({
      distance: entry.id.includes(needle)
        ? 0
        : editDistance(needle, entry.id.toLowerCase()),
      id: entry.id,
    }))
    .filter(({ distance }) => distance <= threshold)
    .toSorted((left, right) => left.distance - right.distance)
    .slice(0, MAX_SUGGESTIONS)
    .map((suggestion) => suggestion.id);
};

/**
 * Definitions whose id, title, description, placements, tags, or rendered
 * output contain `query`, case-insensitively. Answers "which definition
 * renders this text I see in the UI?".
 */
export const searchDefinitions = (
  analysis: Analysis,
  query: string
): DefinitionEntry[] => {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return analysis.entries;
  }
  const rendered = new Map(
    analysis.snapshots.map((snapshot) => [
      snapshot.id,
      snapshot.content.toLowerCase(),
    ])
  );
  return analysis.entries.filter(
    (entry) =>
      [
        entry.id,
        entry.title ?? "",
        entry.description ?? "",
        ...entry.placements,
        ...entry.tags,
      ].some((value) => value.toLowerCase().includes(needle)) ||
      (rendered.get(entry.id)?.includes(needle) ?? false)
  );
};
