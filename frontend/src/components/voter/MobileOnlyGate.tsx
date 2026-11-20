"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MobileGateSignal } from "@/lib/voter/mobile-gate";
import { MobileRequiredScreen } from "./MobileRequiredScreen";

export function MobileOnlyGate({
  signal,
  children,
}: Readonly<{
  signal: MobileGateSignal;
  children: ReactNode;
}>) {
  const [blocked, setBlocked] = useState(
    () => signal === "desktop" || signal === "ambiguous",
  );

  useEffect(() => {
    if (signal !== "desktop" && signal !== "ambiguous") {
      return;
    }

    // This is friction, not security: coarse pointers can be spoofed or absent.
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const hasTouch = navigator.maxTouchPoints > 0;
    const nextBlocked = !(isCoarsePointer && hasTouch);
    queueMicrotask(() => setBlocked(nextBlocked));
  }, [signal]);

  if (blocked) return <MobileRequiredScreen />;
  return children;
}
