"use client";

import { useEffect, useState } from "react";
import { restoreDeviceId } from "./device-id";

export function useDeviceId(publicId: string): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void restoreDeviceId(publicId).then((value) => {
      if (active) setDeviceId(value);
    });
    return () => {
      active = false;
    };
  }, [publicId]);

  return deviceId;
}
