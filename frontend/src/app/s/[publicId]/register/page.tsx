"use client";

import { use } from "react";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { useDeviceId } from "@/lib/voter/use-device-id";
import { useFingerprint } from "@/lib/voter/use-fingerprint";
import { VoterRegistrationForm } from "@/components/voter/VoterRegistrationForm";
import { VoterStateScreen } from "@/components/voter/VoterStateScreen";

export default function VoterRegistrationPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const station = usePublicStation();
  const { publicId } = use(params);
  const deviceId = useDeviceId(publicId);
  const fingerprint = useFingerprint();

  const status = station?.status.toUpperCase();
  if (
    station &&
    (station.mode !== "CLOSED_VOTE" ||
      !["REG_OPEN", "REGISTRATION_OPEN"].includes(status ?? ""))
  ) {
    if (status === "CANCELLED") {
      return <VoterStateScreen publicId={publicId} state="CANCELLED" />;
    }
    if (["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(status ?? "")) {
      return <VoterStateScreen publicId={publicId} state="VOTE_CLOSED" />;
    }
    if (["REG_CLOSED", "REGISTRATION_CLOSED"].includes(status ?? "")) {
      return (
        <VoterStateScreen
          publicId={publicId}
          state="REGISTRATION_CLOSED"
        />
      );
    }
    return <VoterStateScreen publicId={publicId} state="NOT_OPEN" />;
  }

  return (
    <main className="voter-page">
      <section className="voter-page__card">
        <VoterRegistrationForm
          publicId={publicId}
          stationName={station?.name ?? publicId}
          deviceId={deviceId}
          fingerprint={fingerprint}
        />
      </section>
    </main>
  );
}
