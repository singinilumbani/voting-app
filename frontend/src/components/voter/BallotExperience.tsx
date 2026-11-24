"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { M3Banner, M3Button, M3Card, ProgressBar } from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";
import { votingApi } from "@/lib/api/voting";
import type { PublicStationDto } from "@/lib/api/schemas";
import {
  clearBallotDraft,
  clearBallotSession,
  readBallotDraft,
  readBallotSession,
  storeResultsAccessToken,
  storeBallotDraft,
  storeBallotSession,
  type BallotSelections,
} from "@/lib/voter/ballot-storage";

type BallotCategory = Readonly<{
  id: string;
  title: string;
  candidates: readonly Readonly<{
    id: string;
    name: string;
    imageUrl: string | null;
  }>[];
}>;

export function CandidateCard({
  candidate,
  categoryTitle,
  selected,
  onSelect,
}: Readonly<{
  candidate: Readonly<{ id: string; name: string; imageUrl: string | null }>;
  categoryTitle: string;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      className={`voter-candidate${selected ? " voter-candidate--selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {candidate.imageUrl ? (
        <span className="voter-candidate__image">
          <Image
            src={candidate.imageUrl}
            alt=""
            fill
            sizes="(max-width: 767px) 50vw, 16rem"
            quality={72}
          />
        </span>
      ) : (
        <span className="voter-candidate__image voter-candidate__image--empty" aria-hidden="true">
          <Icon name="person" />
        </span>
      )}
      {selected && (
        <span className="voter-candidate__check" aria-hidden="true">
          <Icon name="check_circle" />
        </span>
      )}
      <span className="voter-candidate__name">{candidate.name}</span>
      <span className="voter-candidate__position">{categoryTitle}</span>
    </button>
  );
}

export function CategoryBallotCard({
  category,
  allowAbstain,
  selection,
  onSelect,
}: Readonly<{
  category: BallotCategory;
  allowAbstain: boolean;
  selection?: string;
  onSelect: (choice: string) => void;
}>) {
  const t = useT();
  return (
    <div data-category={category.id}>
      <M3Card as="section" className="voter-category-ballot">
        <h2>{category.title}</h2>
        <div className="voter-candidate-grid">
        {category.candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            categoryTitle={category.title}
            selected={selection === candidate.id}
            onSelect={() => onSelect(candidate.id)}
          />
        ))}
        {allowAbstain && (
          <button
            type="button"
            className={`voter-candidate voter-candidate--abstain${selection === "ABSTAIN" ? " voter-candidate--selected" : ""}`}
            aria-pressed={selection === "ABSTAIN"}
            onClick={() => onSelect("ABSTAIN")}
          >
            {selection === "ABSTAIN" && (
              <span className="voter-candidate__check" aria-hidden="true">
                <Icon name="check_circle" />
              </span>
            )}
            <span className="voter-candidate__name">{t("voter.ballot.abstain")}</span>
            <span className="voter-candidate__position">{category.title}</span>
          </button>
        )}
        </div>
      </M3Card>
    </div>
  );
}

export function BallotExperience({
  publicId,
  station,
  ballot,
  ballotSession,
  expiresAt,
  deviceId,
  fingerprint,
}: Readonly<{
  publicId: string;
  station: PublicStationDto["station"];
  ballot: readonly BallotCategory[];
  ballotSession?: string;
  expiresAt?: string;
  deviceId?: string | null;
  fingerprint?: string;
}>) {
  const t = useT();
  const router = useRouter();
  const [selections, setSelections] = useState<BallotSelections>(() =>
    typeof window === "undefined" ? {} : readBallotDraft(publicId),
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(
    () => Boolean(expiresAt && Date.parse(expiresAt) <= Date.now()),
  );
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (ballotSession) {
      const existing = readBallotSession(publicId);
      if (existing?.ballotSession !== ballotSession) {
        storeBallotSession(publicId, ballotSession, expiresAt ?? "");
      }
    }
  }, [ballotSession, expiresAt, publicId]);

  useEffect(() => {
    storeBallotDraft(publicId, selections);
  }, [publicId, selections]);

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

  const selectedCount = useMemo(
    () => ballot.filter((category) => selections[category.id]).length,
    [ballot, selections],
  );
  const missing = ballot
    .filter((category) => !selections[category.id])
    .map((category) => category.title);

  function choose(categoryId: string, choice: string): void {
    setSelections((current) => ({ ...current, [categoryId]: choice }));
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = ballot.map((category) => ({
        categoryId: category.id,
        candidateId: selections[category.id] as string,
      }));
      const result = await votingApi.submitBallot(
        publicId,
        payload,
        station.mode === "CLOSED_VOTE" ? ballotSession : undefined,
        station.mode === "PUBLIC_POLL"
          ? {
              deviceUuid: deviceId ?? "",
              fingerprintHash: fingerprint ?? "",
            }
          : undefined,
      );
      clearBallotDraft(publicId);
      clearBallotSession(publicId);
      if (result.resultsAccessToken) {
        storeResultsAccessToken(publicId, result.resultsAccessToken);
      }
      const query = result.resultsAccessToken
        ? `?access=${encodeURIComponent(result.resultsAccessToken)}`
        : "";
      router.push(`/s/${encodeURIComponent(publicId)}/success${query}`);
    } catch (error) {
      if (error instanceof ApiError &&
          error.key === "errors.vote.session_expired") {
        setSessionExpired(true);
        clearBallotSession(publicId);
      } else {
        setSubmitError(
          error instanceof ApiError ? error.key : "voter.ballot.networkError",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionExpired) {
    return (
      <M3Banner variant="warning">
        {t("voter.ballot.sessionExpired")}
        <M3Button variant="text" onClick={() => router.push(`/s/${encodeURIComponent(publicId)}/vote`)}>
          {t("voter.ballot.reenter")}
        </M3Button>
      </M3Banner>
    );
  }

  return (
    <main className="voter-ballot">
      <header className="voter-ballot__header">
        <h1>{station.name}</h1>
        {station.mode === "PUBLIC_POLL" && (
          <M3Banner variant="info">{t("voter.ballot.openPollWarning")}</M3Banner>
        )}
        {!isOnline && (
          <M3Banner variant="warning">{t("voter.ballot.offlineDraft")}</M3Banner>
        )}
      </header>
      <div className="voter-ballot__categories">
        {ballot.map((category) => (
          <CategoryBallotCard
            key={category.id}
            category={category}
            allowAbstain={station.allowAbstain}
            selection={selections[category.id]}
            onSelect={(choice) => choose(category.id, choice)}
          />
        ))}
      </div>
      <div className="voter-ballot__submit">
        <ProgressBar
          value={ballot.length === 0 ? 0 : (selectedCount / ballot.length) * 100}
          label={t("voter.ballot.progress", {
            selected: selectedCount,
            total: ballot.length,
          })}
        />
        {missing.length > 0 && (
          <p>{t("voter.ballot.missing", { missing: missing.join(", ") })}</p>
        )}
        {submitError && <M3Banner variant="error">{t(submitError)}</M3Banner>}
        <M3Button
          type="button"
          disabled={selectedCount !== ballot.length}
          loading={submitting}
          onClick={() => setReviewOpen(true)}
        >
          {t("voter.ballot.submit")}
        </M3Button>
      </div>
      <M3ModalDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={t("voter.ballot.reviewTitle")}
        actions={
          <>
            <M3Button variant="text" onClick={() => setReviewOpen(false)}>
              {t("voter.ballot.goBack")}
            </M3Button>
            <M3Button
              loading={submitting}
              disabled={submitting}
              onClick={() => void submit()}
            >
              {t("voter.ballot.confirm")}
            </M3Button>
          </>
        }
      >
        <ol className="voter-review">
          {ballot.map((category) => {
            const choice = selections[category.id];
            const candidate = category.candidates.find((item) => item.id === choice);
            return (
              <li key={category.id}>
                <div>
                  <strong>{category.title}</strong>
                  <span>
                    {choice === "ABSTAIN"
                      ? t("voter.ballot.abstain")
                      : candidate?.name ?? t("voter.ballot.noSelection")}
                  </span>
                </div>
                <M3Button
                  variant="text"
                  onClick={() => {
                    setReviewOpen(false);
                    document
                      .querySelector<HTMLElement>(`[data-category="${category.id}"]`)
                      ?.focus();
                  }}
                >
                  {t("voter.ballot.edit")}
                </M3Button>
              </li>
            );
          })}
        </ol>
      </M3ModalDialog>
    </main>
  );
}
