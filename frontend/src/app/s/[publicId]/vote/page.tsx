"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { useDeviceId } from "@/lib/voter/use-device-id";
import { useFingerprint } from "@/lib/voter/use-fingerprint";
import { readVoterToken } from "@/lib/voter/voter-token";
import { votingApi } from "@/lib/api/voting";
import { ApiError } from "@/lib/api/client";
import { normalizePhoneInput, normalizeTokenInput } from "@/lib/shared";
import { PhoneField } from "@/components/ui/PhoneField";
import { CodeField } from "@/components/ui/CodeField";
import {
  M3Banner,
  M3Button,
  M3Card,
  SkeletonLoader,
} from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";
import { BallotExperience } from "@/components/voter/BallotExperience";

type BallotEntry = Readonly<{
  alreadyVoted: boolean;
  ballotSession: string;
  expiresAt: string;
  ballot: readonly Readonly<{
    id: string;
    title: string;
    candidates: readonly Readonly<{
      id: string;
      name: string;
      imageUrl: string | null;
    }>[];
  }>[];
}>;

export default function PublicVotePage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const router = useRouter();
  const station = usePublicStation();
  const { publicId } = use(params);
  const deviceId = useDeviceId(publicId);
  const fingerprint = useFingerprint();
  const [storedToken] = useState(() =>
    typeof window === "undefined" ? null : readVoterToken(publicId),
  );
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [entry, setEntry] = useState<BallotEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lockedWait, setLockedWait] = useState<string | null>(null);

  async function enter(inputToken: string, inputPhone?: string): Promise<void> {
    setLoading(true);
    setErrorKey(null);
    setLockedWait(null);
    try {
      const result = await votingApi.enterBallot(publicId, {
        token: inputToken,
        phone: inputPhone,
      });
      setEntry(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(error.key);
        if (error.key === "errors.vote.token_locked") {
          const wait = error.params?.waitMinutes ?? error.params?.minutes;
          if (typeof wait === "number" || typeof wait === "string") {
            setLockedWait(String(wait));
          }
        }
      } else {
        setErrorKey("voter.vote.networkError");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      station?.mode === "CLOSED_VOTE" &&
      station.status.toUpperCase().includes("VOTE_OPEN") &&
      storedToken
    ) {
      const timer = window.setTimeout(() => void enter(storedToken), 0);
      return () => window.clearTimeout(timer);
    }
    // Stored-token auto-entry is intentionally limited to mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, storedToken]);

  if (!station) {
    return (
      <main className="voter-page">
        <M3Card className="voter-page__card">
          <SkeletonLoader label={t("voter.vote.loading")} count={2} />
        </M3Card>
      </main>
    );
  }

  const status = station.status.toUpperCase();
  if (["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED", "CANCELLED"].includes(status)) {
    return (
      <main className="voter-page">
        <M3Card className="voter-page__card">
          <h1>{t(status === "CANCELLED" ? "voter.states.cancelledTitle" : "voter.vote.closedTitle")}</h1>
          <p>{t(status === "CANCELLED" ? "voter.states.cancelledDescription" : "voter.vote.closedDescription")}</p>
        </M3Card>
      </main>
    );
  }
  if (
    station.mode === "CLOSED_VOTE" &&
    !["VOTE_OPEN", "VOTING_OPEN"].includes(status)
  ) {
    return (
      <main className="voter-page">
        <M3Card className="voter-page__card">
          <h1>{t("voter.vote.notOpenTitle")}</h1>
          <p>{t("voter.vote.notOpenDescription")}</p>
          {station.voteStartsAt && (
            <M3Banner variant="info">
              {t("voter.vote.opensAt", { time: new Date(station.voteStartsAt).toLocaleString("en-MW") })}
            </M3Banner>
          )}
        </M3Card>
      </main>
    );
  }

  if (station.mode === "PUBLIC_POLL") {
    const publicBallot = (station.categories ?? []).map((category) => ({
      id: category.id,
      title: category.title,
      candidates: (category.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        imageUrl: candidate.imageUrl ?? candidate.picture ?? null,
      })),
    }));
    if (!["VOTE_OPEN", "VOTING_OPEN"].includes(status)) {
      return (
        <main className="voter-page">
          <M3Card className="voter-page__card">
            <h1>{t("voter.vote.notOpenTitle")}</h1>
          </M3Card>
        </main>
      );
    }
    if (!deviceId) {
      return (
        <main className="voter-page">
          <M3Card className="voter-page__card">
            <p>{t("voter.registration.deviceUnavailable")}</p>
          </M3Card>
        </main>
      );
    }
    return (
      <BallotExperience
        publicId={publicId}
        station={station}
        ballot={publicBallot}
        deviceId={deviceId}
        fingerprint={fingerprint}
      />
    );
  }

  if (entry) {
    return (
      <BallotExperience
        publicId={publicId}
        station={station}
        ballot={entry.ballot}
        ballotSession={entry.ballotSession}
        expiresAt={entry.expiresAt}
      />
    );
  }

  function submitManual(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const tokenResult = normalizeTokenInput(token);
    const phoneResult = phone ? normalizePhoneInput(phone) : null;
    if (!tokenResult.ok) {
      setErrorKey(
        tokenResult.reason === "INVALID_LENGTH"
          ? "errors.token.invalid_length"
          : "errors.token.invalid_characters",
      );
      return;
    }
    if (phoneResult && !phoneResult.ok) {
      setErrorKey(`errors.phone.${phoneResult.reason.toLowerCase()}`);
      return;
    }
    void enter(
      tokenResult.normalized,
      phoneResult?.ok ? phoneResult.canonical : undefined,
    );
  }

  return (
    <main className="voter-page">
      <M3Card className="voter-page__card">
        <h1>{t("voter.vote.entryTitle")}</h1>
        {loading && <SkeletonLoader label={t("voter.vote.loading")} count={2} />}
        {errorKey && (
          <M3Banner variant="error">
            {t(errorKey)}
            {errorKey === "errors.vote.token_locked" && lockedWait
              ? ` ${t("voter.vote.lockedWait", { minutes: lockedWait })}`
              : ""}
            {errorKey === "errors.vote.already_voted" && (
              <M3Button
                variant="text"
                onClick={() =>
                  router.push(
                    `/s/${encodeURIComponent(publicId)}/results`,
                  )
                }
              >
                {t("voter.vote.viewResults")}
              </M3Button>
            )}
            <M3Button variant="text" onClick={() => void enter(token)}>
              {t("voter.vote.retry")}
            </M3Button>
          </M3Banner>
        )}
        {!loading && !errorKey && (
          <form className="voter-registration-form" onSubmit={submitManual} noValidate>
            <CodeField
              label={t("voter.vote.token")}
              value={token}
              onValueChange={setToken}
            />
            <PhoneField
              label={t("voter.vote.phoneOptional")}
              value={phone}
              onChange={(event) => setPhone(event.currentTarget.value)}
            />
            <M3Button type="submit" disabled={loading}>
              {t("voter.vote.enter")}
            </M3Button>
          </form>
        )}
      </M3Card>
    </main>
  );
}
