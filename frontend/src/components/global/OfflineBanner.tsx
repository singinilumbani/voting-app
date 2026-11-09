"use client";

import { useEffect, useState } from "react";
import { M3Banner } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const t = useT();

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (isOnline) return null;
  return (
    <div className="global-offline-banner">
      <M3Banner variant="warning">{t("global.offline")}</M3Banner>
    </div>
  );
}
