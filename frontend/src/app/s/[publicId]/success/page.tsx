"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { readResultsAccessToken } from "@/lib/voter/ballot-storage";
import { M3Banner, M3Card } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export default function VotingSuccessPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const router = useRouter();
  const station = usePublicStation();
  const [publicId, setPublicId] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void params.then((value) => {
      if (!active) return;
      setPublicId(value.publicId);
      window.setTimeout(() => {
        if (active) setAccessToken(readResultsAccessToken(value.publicId));
      }, 0);
    });
    return () => {
      active = false;
    };
  }, [params]);


  useEffect(() => {
    if (station?.resultsVisibility === "IMMEDIATE" && accessToken) {
      router.replace(
        `/s/${encodeURIComponent(publicId)}/results?access=${encodeURIComponent(accessToken)}`,
      );
    }
  }, [accessToken, publicId, router, station]);

  const endTime =
    station?.voteEndsAt
      ? new Date(station.voteEndsAt).toLocaleString("en-MW")
      : null;

  if (station?.resultsVisibility === "IMMEDIATE" && accessToken) {
    return (
      <main className="voter-page">
        <M3Card className="voter-page__card">
          <h1>{t("voter.success.title")}</h1>
          <p>{t("voter.success.description")}</p>
        </M3Card>
      </main>
    );
  }

  return (
    <main className="voter-page">
      <M3Card className="voter-page__card">
        <h1>{t("voter.success.title")}</h1>
        <p>{t("voter.success.description")}</p>
        {station?.mode === "CLOSED_VOTE" ? (
          <M3Banner variant="info">{t("voter.success.concealed")}</M3Banner>
        ) : (
          <M3Banner variant="info">{t("voter.ballot.openPollWarning")}</M3Banner>
        )}
        {endTime && (
          <p>{t("voter.success.votingEnds", { time: endTime })}</p>
        )}
      </M3Card>
    </main>
  );
}
