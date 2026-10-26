import { useSyncExternalStore } from "react";

import { fetchManifest, subscribe } from "./api";
import type { StudioManifest } from "./types";

interface ManifestState {
  error?: string;
  manifest?: StudioManifest;
}

let state: ManifestState = {};
const listeners = new Set<() => void>();
let stopEvents: (() => void) | undefined;

const emit = (next: ManifestState) => {
  state = next;
  for (const listener of listeners) {
    listener();
  }
};

const refresh = async () => {
  try {
    emit({ manifest: await fetchManifest() });
  } catch (error) {
    emit({
      ...state,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const subscribeManifest = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    refresh();
    stopEvents = subscribe(refresh, (message) =>
      emit({ ...state, error: message })
    );
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopEvents?.();
    }
  };
};

/** The project manifest, refetched whenever the CLI reloads content. */
export const useManifest = () =>
  useSyncExternalStore(subscribeManifest, () => state);
