"use client";

import { useEffect, useState } from "react";

export async function loadFingerprint(): Promise<string> {
  try {
    const { getThumbmark } = await import("@thumbmarkjs/thumbmarkjs");
    const result = await getThumbmark({
      collect_beacon: false,
      logging: false,
    });
    return result.thumbmark || "";
  } catch {
    return "";
  }
}

export function useFingerprint(): string {
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    let active = true;
    void loadFingerprint().then((value) => {
      if (active) setFingerprint(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return fingerprint;
}
