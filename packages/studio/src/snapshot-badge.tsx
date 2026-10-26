import type { SnapshotState } from "./types";

const LABELS: Record<SnapshotState, string> = {
  changed: "Snapshot out of date",
  missing: "No snapshot",
  "up-to-date": "Snapshot up to date",
};

const DOT_CLASSES: Record<SnapshotState, string> = {
  changed: "bg-amber-500",
  missing: "bg-destructive",
  "up-to-date": "bg-primary",
};

export const SnapshotDot = ({ state }: { state: SnapshotState }) => (
  <span className="inline-flex shrink-0" title={LABELS[state]}>
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-full ${DOT_CLASSES[state]}`}
    />
    <span className="sr-only">{LABELS[state]}</span>
  </span>
);

export const SnapshotBadge = ({ state }: { state: SnapshotState }) => (
  <span className="text-muted-foreground inline-flex items-center gap-2 text-xs">
    <SnapshotDot state={state} />
    {LABELS[state]}
  </span>
);
