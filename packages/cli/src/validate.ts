import type { LoadedDefinition, Project } from "./load";
import { createSnapshot } from "./snapshot";
import type { Snapshot } from "./snapshot";

/** What kind of problem an issue is, for tools that act on it. */
export type IssueCode =
  | "alias-conflict"
  | "nondeterministic"
  | "removed-without-alias"
  | "render-failed"
  | "snapshot-changed"
  | "snapshot-missing"
  | "snapshot-orphaned"
  | "unknown-placement"
  | "unused";

export interface Issue {
  code: IssueCode;
  id?: string;
  level: "error" | "warning";
  message: string;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const placementIssues = (
  project: Project,
  { definition }: LoadedDefinition
): Issue[] => {
  const known = project.config.placements;
  if (!known) {
    return [];
  }
  return (definition.placements ?? [])
    .filter((placement) => !(placement in known))
    .map((placement) => ({
      code: "unknown-placement",
      id: definition.id,
      level: "error",
      message: `Unknown placement "${placement}". Add it to placements in the config.`,
    }));
};

const aliasIssues = (definitions: readonly LoadedDefinition[]): Issue[] => {
  const ids = new Set(definitions.map(({ definition }) => definition.id));
  const owners = new Map<string, string>();
  const issues: Issue[] = [];
  for (const { definition } of definitions) {
    for (const alias of definition.aliases ?? []) {
      if (ids.has(alias)) {
        issues.push({
          code: "alias-conflict",
          id: definition.id,
          level: "error",
          message: `Alias "${alias}" is the id of another definition.`,
        });
      }
      const owner = owners.get(alias);
      if (owner) {
        issues.push({
          code: "alias-conflict",
          id: definition.id,
          level: "error",
          message: `Alias "${alias}" is also an alias of "${owner}".`,
        });
      }
      owners.set(alias, definition.id);
    }
  }
  return issues;
};

/**
 * Renders a snapshot for every definition and validates the project:
 * examples, deterministic rendering, placements, and aliases.
 */
export const buildSnapshots = (
  project: Project
): { issues: Issue[]; snapshots: Snapshot[] } => {
  const issues: Issue[] = [...aliasIssues(project.definitions)];
  const snapshots: Snapshot[] = [];

  for (const loaded of project.definitions) {
    issues.push(...placementIssues(project, loaded));
    try {
      const snapshot = createSnapshot(project.config, loaded);
      const again = createSnapshot(project.config, loaded);
      if (again.content !== snapshot.content) {
        issues.push({
          code: "nondeterministic",
          id: loaded.definition.id,
          level: "error",
          message:
            "Renders differently each time. Templates must be pure: no dates, random values, or I/O.",
        });
      }
      snapshots.push(snapshot);
    } catch (error) {
      issues.push({
        code: "render-failed",
        id: loaded.definition.id,
        level: "error",
        message: errorMessage(error),
      });
    }
  }

  return { issues, snapshots };
};
