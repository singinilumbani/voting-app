"use client";

import { useSyncExternalStore } from "react";

export function getPollingInterval(
  isVisible: boolean,
  intervalMs: number,
): number | false {
  return isVisible && Number.isFinite(intervalMs) && intervalMs > 0
    ? intervalMs
    : false;
}

function subscribeToVisibility(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function isDocumentVisible(): boolean {
  return (
    typeof document === "undefined" || document.visibilityState === "visible"
  );
}

export function usePollingInterval(intervalMs: number): number | false {
  const isVisible = useSyncExternalStore(
    subscribeToVisibility,
    isDocumentVisible,
    () => true,
  );
  return getPollingInterval(isVisible, intervalMs);
}
