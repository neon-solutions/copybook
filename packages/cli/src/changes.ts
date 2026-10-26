import path from "node:path";

import { changedFiles } from "./git";
import type { Project } from "./load";
import { compareSnapshots, SNAPSHOT_EXTENSION } from "./snapshot";
import type { Snapshot } from "./snapshot";

/**
 * Ids whose rendered output differs from `base`: snapshot files changed in
 * git, plus definitions whose snapshot isn't written yet.
 */
export const changedIds = async (
  project: Project,
  snapshots: readonly Snapshot[],
  base: string
): Promise<string[]> => {
  const [files, status] = await Promise.all([
    changedFiles(project.config.root, project.config.snapshotsDir, base),
    compareSnapshots(project.config, snapshots),
  ]);
  const defined = new Set(snapshots.map((snapshot) => snapshot.id));
  const ids = new Set([
    ...files
      .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
      .map((file) => path.basename(file, SNAPSHOT_EXTENSION)),
    ...status.missing,
    ...status.changed.map((change) => change.id),
  ]);
  return [...ids].filter((id) => defined.has(id)).toSorted();
};

/** Snapshot files removed since `base` whose id isn't kept as an alias. */
export const removedWithoutAlias = async (
  project: Project,
  base: string
): Promise<string[]> => {
  const files = await changedFiles(
    project.config.root,
    project.config.snapshotsDir,
    base
  );
  const current = new Set(
    project.definitions.map(({ definition }) => definition.id)
  );
  const aliases = new Set(
    project.definitions.flatMap(({ definition }) => definition.aliases ?? [])
  );
  return files
    .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
    .map((file) => path.basename(file, SNAPSHOT_EXTENSION))
    .filter((id) => !current.has(id) && !aliases.has(id));
};
