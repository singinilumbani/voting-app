"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { votingApi } from "@/lib/api/voting";
import { ApiError } from "@/lib/api/client";
import { readResultsAccessToken } from "@/lib/voter/ballot-storage";
import {
  M3Banner,
  M3Card,
  SkeletonLoader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export default function PublicResultsPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const station = usePublicStation();
  const { publicId } = use(params);
  const searchParams = useSearchParams();
  const [accessToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return (
      searchParams.get("access") ?? readResultsAccessToken(publicId)
    );
  });
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof votingApi.results>> | null
  >(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const concealedWaiting =
    station?.resultsVisibility === "CONCEALED" &&
    !["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(
      station.status.toUpperCase(),
    );

  useEffect(() => {
    if (!station || concealedWaiting) return;
    let active = true;
    void votingApi
      .results(publicId, accessToken ?? undefined)
      .then((value) => {
        if (active) setResults(value);
      })
      .catch((error) => {
        if (!active) return;
        setErrorKey(
          error instanceof ApiError ? error.key : "voter.results.loadError",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, concealedWaiting, publicId, station]);

  const isFinal = useMemo(
    () =>
      station
        ? ["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(
            station.status.toUpperCase(),
          )
        : false,
    [station],
  );

  return (
    <main className="voter-results">
      <header>
        <h1>{t("voter.results.title")}</h1>
        {station?.mode === "PUBLIC_POLL" && (
          <M3Banner variant="warning">
            {t("voter.results.openPollWarning")}
          </M3Banner>
        )}
        {isFinal && <StatusBadge status="success">{t("voter.results.final")}</StatusBadge>}
      </header>
      {concealedWaiting ? (
        <M3Banner variant="info">{t("voter.results.notPublished")}</M3Banner>
      ) : loading ? (
        <SkeletonLoader label={t("voter.results.loading")} count={3} />
      ) : errorKey ? (
        <M3Banner variant="info">{t(errorKey)}</M3Banner>
      ) : (
        <div className="voter-results__categories">
          {results?.map((category) => (
            <M3Card as="section" key={category.id} className="voter-results__category">
              <h2>{category.title}</h2>
              <ol className="analytics-leaderboard">
                {category.candidates.map((candidate) => {
                  const result = category.results.find(
                    (item) => item.candidateId === candidate.id,
                  );
                  const count = result?.count ?? 0;
                  const total = category.results.reduce(
                    (sum, item) => sum + item.count,
                    0,
                  );
                  const percentage =
                    total > 0 ? (count / total) * 100 : 0;
                  const highestCount = Math.max(
                    0,
                    ...category.results.map((item) => item.count),
                  );
                  const tied =
                    count > 0 &&
                    highestCount > 0 &&
                    category.results.filter((item) => item.count === highestCount)
                      .length > 1 &&
                    count === highestCount;
                  const leader = count === highestCount && count > 0;
                  return (
                    <li className="analytics-leaderboard__candidate" key={candidate.id}>
                      <div className="analytics-leaderboard__candidate-meta">
                        <strong>{candidate.name}</strong>
                        <span>{t("analytics.candidateResult", { percentage: percentage.toFixed(1), count })}</span>
                      </div>
                      <div className="analytics-leaderboard__bar">
                        <span
                          className={
                            leader
                              ? "analytics-leaderboard__bar-fill analytics-leaderboard__bar-fill--leader"
                              : "analytics-leaderboard__bar-fill"
                          }
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="analytics-leaderboard__badges">
                        {leader && <span className="analytics-leaderboard__leader">{t("analytics.leader")}</span>}
                        {tied && <StatusBadge status="warning">{t("analytics.tie")}</StatusBadge>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </M3Card>
          ))}
        </div>
      )}
    </main>
  );
}
