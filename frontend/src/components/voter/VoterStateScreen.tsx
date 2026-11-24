"use client";

import Link from "next/link";
import { M3Banner, M3Card, M3Button } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export type VoterState =
  | "REGISTRATION_CLOSED"
  | "NOT_OPEN"
  | "VOTE_CLOSED"
  | "CANCELLED"
  | "REGISTRATION_FULL";

export function VoterStateScreen({
  publicId,
  state,
  countdown,
}: Readonly<{ publicId: string; state: VoterState; countdown?: string }>) {
  const t = useT();
  const copy: Record<VoterState, { title: string; description: string }> = {
    REGISTRATION_CLOSED: {
      title: "voter.states.registrationClosedTitle",
      description: "voter.states.registrationClosedDescription",
    },
    NOT_OPEN: {
      title: "voter.states.notOpenTitle",
      description: "voter.states.notOpenDescription",
    },
    VOTE_CLOSED: {
      title: "voter.states.voteClosedTitle",
      description: "voter.states.voteClosedDescription",
    },
    CANCELLED: {
      title: "voter.states.cancelledTitle",
      description: "voter.states.cancelledDescription",
    },
    REGISTRATION_FULL: {
      title: "voter.states.registrationFullTitle",
      description: "voter.states.registrationFullDescription",
    },
  };

  return (
    <main className="voter-page">
      <M3Card className="voter-page__card">
        <h1>{t(copy[state].title)}</h1>
        <p>{t(copy[state].description)}</p>
        {countdown && <M3Banner variant="info">{countdown}</M3Banner>}
        {state === "NOT_OPEN" && (
          <M3Button variant="outlined" onClick={() => window.location.reload()}>
            {t("voter.states.checkAgain")}
          </M3Button>
        )}
        {state === "REGISTRATION_FULL" && (
          <Link className="ui-button ui-button--outlined" href={`/s/${encodeURIComponent(publicId)}`}>
            {t("voter.states.backToStation")}
          </Link>
        )}
      </M3Card>
    </main>
  );
}

