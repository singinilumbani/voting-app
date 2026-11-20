"use client";

import { use } from "react";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { DevicePrivacyNotice } from "@/components/voter/PrivacyNotice";
import { useDeviceId } from "@/lib/voter/use-device-id";
import { useFingerprint } from "@/lib/voter/use-fingerprint";
import { useT } from "@/lib/i18n";

export default function PublicPollBallotPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const station = usePublicStation();
  const { publicId } = use(params);
  const deviceId = useDeviceId(publicId);
  const fingerprint = useFingerprint();

  return (
    <main className="voter-page">
      <section className="voter-page__card">
        <h1>{t("voter.ballot.title")}</h1>
        <p>{station?.name ?? t("voter.stationFallback")}</p>
        <DevicePrivacyNotice />
        {deviceId && fingerprint && (
          <p className="voter-page__signal-status" aria-live="polite">
            {t("voter.signalsReady")}
          </p>
        )}
      </section>
    </main>
  );
}
