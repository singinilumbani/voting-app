"use client";

import { useT } from "@/lib/i18n";

export function DevicePrivacyNotice() {
  const t = useT();
  return (
    <p className="voter-privacy-notice" role="note">
      {t("voter.devicePrivacyNotice")}
    </p>
  );
}
