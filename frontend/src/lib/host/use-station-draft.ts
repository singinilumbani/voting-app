"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  parseStationDraft,
  stationDraftChangedEvent,
  stationDraftStorageKey,
  type StationWizardDraft,
} from "./station-draft";

const storageErrorSnapshot = "__station-draft-storage-error__";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(stationDraftChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(stationDraftChangedEvent, onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(stationDraftStorageKey);
  } catch {
    return storageErrorSnapshot;
  }
}

function getServerSnapshot(): null {
  return null;
}

export type StationDraftSnapshot = Readonly<{
  draft: StationWizardDraft | null;
  error: string | null;
}>;

export function useStationDraft(): StationDraftSnapshot {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    if (raw === null) return { draft: null, error: null };
    if (raw === storageErrorSnapshot) {
      return { draft: null, error: "station.draft.storageUnavailable" };
    }
    try {
      return { draft: parseStationDraft(raw), error: null };
    } catch {
      return { draft: null, error: "station.draft.invalid" };
    }
  }, [raw]);
}
