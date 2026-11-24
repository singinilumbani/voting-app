"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { VoterStateScreen } from "@/components/voter/VoterStateScreen";
import { getVoterEntryRoute } from "@/lib/voter/voter-entry";
import { useT } from "@/lib/i18n";
import { M3Banner } from "@/components/ui/primitives";

function countdownLabel(
  end: string | null,
  t: ReturnType<typeof useT>,
): string | undefined {
  if (!end) return undefined;
  const remaining = Math.max(
    0,
    Math.floor((Date.parse(end) - Date.now()) / 1000),
  );
  if (!Number.isFinite(remaining)) return undefined;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return t("voter.countdown", {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  });
}

export default function PublicStationPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const router = useRouter();
  const station = usePublicStation();
  const [publicId, setPublicId] = useState("");

  useEffect(() => {
    let active = true;
    void params.then((value) => {
      if (active) setPublicId(value.publicId);
    });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!station || !publicId) return;
    const route = getVoterEntryRoute(station);
    if (route) router.replace(`/s/${encodeURIComponent(publicId)}${route}`);
  }, [publicId, router, station]);

  if (!station) {
    return (
      <main className="voter-page">
        <M3Banner variant="error">{t("voter.states.loadError")}</M3Banner>
      </main>
    );
  }

  const status = station.status.toUpperCase();
  if (status === "CANCELLED") {
    return <VoterStateScreen publicId={publicId} state="CANCELLED" />;
  }
  if (["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(status)) {
    return <VoterStateScreen publicId={publicId} state="VOTE_CLOSED" />;
  }
  if (
    station.mode === "CLOSED_VOTE" &&
    ["REG_CLOSED", "REGISTRATION_CLOSED"].includes(status)
  ) {
    return (
      <VoterStateScreen
        publicId={publicId}
        state="REGISTRATION_CLOSED"
        countdown={countdownLabel(station.voteStartsAt, t)}
      />
    );
  }
  if (status === "DRAFT" || status === "SCHEDULED") {
    return <VoterStateScreen publicId={publicId} state="NOT_OPEN" />;
  }
  return <VoterStateScreen publicId={publicId} state="NOT_OPEN" />;
}
