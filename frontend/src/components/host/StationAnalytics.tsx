"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import type {
  AnalyticsAudit,
  AnalyticsSnapshot,
  StationDto,
} from "@/lib/api/schemas";
import { analyticsApi } from "@/lib/api/analytics";
import {
  M3Banner,
  M3Button,
  M3Card,
  SkeletonLoader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";
import { usePollingInterval } from "@/lib/polling";

const analyticsPollIntervalMs = 4_000;
const analyticsMaxPollIntervalMs = 30_000;

export function getAnalyticsPollingInterval(
  isVisible: boolean,
  votingOpen: boolean,
  failureCount: number,
): number | false {
  if (!isVisible || !votingOpen) return false;
  const exponent = Math.min(3, Math.max(0, Math.floor(failureCount)));
  return Math.min(
    analyticsMaxPollIntervalMs,
    analyticsPollIntervalMs * 2 ** exponent,
  );
}

function useVisibleClock(): number {
  const [now, setNow] = useState(0);
  const interval = usePollingInterval(1_000);

  useEffect(() => {
    if (interval === false) return;
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);

  return now;
}

function errorKey(error: unknown): string {
  return error instanceof ApiError ? error.key : "errors.internal";
}

type ConnectionState = "connected" | "reconnecting" | "offline";

export function ConnectionStatusBadge({
  state,
  lastUpdated,
}: Readonly<{
  state: ConnectionState;
  lastUpdated?: string;
}>) {
  const t = useT();
  const now = useVisibleClock();
  const statusTone =
    state === "connected"
      ? "success"
      : state === "reconnecting"
        ? "warning"
        : "error";
  const statusLabel = t(`analytics.connection.${state}`);
  const lastUpdatedLabel =
    state !== "offline" && lastUpdated
      ? t("analytics.lastUpdated", {
          age: formatElapsed(lastUpdated, now, t),
        })
      : undefined;

  return (
    <div className="analytics-connection" role="status">
      <StatusBadge status={statusTone}>{statusLabel}</StatusBadge>
      {lastUpdatedLabel && (
        <>
          <span aria-hidden="true">|</span>
          <span>{lastUpdatedLabel}</span>
        </>
      )}
    </div>
  );
}

function formatElapsed(
  timestamp: string,
  now: number,
  t: ReturnType<typeof useT>,
): string {
  if (now === 0) return t("analytics.justNow");
  const updatedAt = Date.parse(timestamp);
  if (!Number.isFinite(updatedAt)) return t("analytics.justNow");
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1_000));
  if (seconds < 60) return t("analytics.secondsAgo", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("analytics.minutesAgo", { count: minutes });
  return t("analytics.hoursAgo", { count: Math.floor(minutes / 60) });
}

export function KpiCard({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <M3Card as="section" className="analytics-kpi">
      <h3>{title}</h3>
      {children}
    </M3Card>
  );
}

export function TurnoutGauge({
  snapshot,
}: Readonly<{ snapshot: AnalyticsSnapshot }>) {
  const t = useT();
  if (snapshot.stationMode === "PUBLIC_POLL") {
    return (
      <KpiCard title={t("analytics.turnoutTitle")}>
        <div className="analytics-kpi__public-count">
          <strong>{snapshot.ballotsCast}</strong>
          <span>{t("analytics.ballotsCastLabel")}</span>
        </div>
        <p>
          {t("analytics.possibleDuplicates", {
            count: snapshot.possibleDuplicates,
          })}
        </p>
      </KpiCard>
    );
  }

  const approvedVoters = snapshot.approvedVoters ?? 0;
  const turnout =
    approvedVoters > 0 ? (snapshot.ballotsCast / approvedVoters) * 100 : 0;
  const ringValue = Math.min(100, Math.max(0, turnout));
  const turnoutLabel = `${turnout.toFixed(1)}%`;

  return (
    <KpiCard title={t("analytics.turnoutTitle")}>
      <div
        className="analytics-turnout__ring"
        role="progressbar"
        aria-label={t("analytics.turnoutTitle")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ringValue}
        style={{
          background: `conic-gradient(var(--color-pacific) ${ringValue}%, var(--color-alabaster) ${ringValue}% 100%)`,
        }}
      >
        <span>{turnoutLabel}</span>
      </div>
      <p>
        {t("analytics.turnoutFraction", {
          ballots: snapshot.ballotsCast,
          approved: approvedVoters,
        })}
      </p>
    </KpiCard>
  );
}

function BallotsCastCard({
  snapshot,
}: Readonly<{ snapshot: AnalyticsSnapshot }>) {
  const t = useT();
  const denominator =
    snapshot.stationMode === "CLOSED_VOTE" ? snapshot.approvedVoters : null;
  return (
    <KpiCard title={t("analytics.ballotsTitle")}>
      <strong className="analytics-kpi__value">
        {denominator === null
          ? snapshot.ballotsCast
          : `${snapshot.ballotsCast} / ${denominator}`}
      </strong>
      <span>{t("analytics.ballotsCastLabel")}</span>
    </KpiCard>
  );
}

function CountdownTimer({
  snapshot,
  voteEndsAt,
}: Readonly<{
  snapshot: AnalyticsSnapshot;
  voteEndsAt?: string | null;
}>) {
  const t = useT();
  const now = useVisibleClock();
  const endsAt = voteEndsAt ? Date.parse(voteEndsAt) : Number.NaN;
  const fallbackEnd =
    snapshot.timeRemainingSeconds !== null
      ? Date.parse(snapshot.lastUpdated) + snapshot.timeRemainingSeconds * 1_000
      : Number.NaN;
  const target = Number.isFinite(endsAt) ? endsAt : fallbackEnd;
  const remainingSeconds =
    Number.isFinite(target) && now > 0
      ? Math.max(0, Math.floor((target - now) / 1_000))
      : snapshot.timeRemainingSeconds;
  const closed =
    snapshot.state === "FINAL" ||
    (remainingSeconds !== null && remainingSeconds <= 0);

  let value: string;
  if (closed) {
    value = t("analytics.countdownClosed");
  } else if (snapshot.state === "WAITING") {
    value = t("analytics.countdownWaiting");
  } else if (remainingSeconds === null) {
    value = t("analytics.countdownUnavailable");
  } else {
    const hours = Math.floor(remainingSeconds / 3_600);
    const minutes = Math.floor((remainingSeconds % 3_600) / 60);
    const seconds = remainingSeconds % 60;
    value = t("analytics.countdownValue", {
      hours: String(hours).padStart(2, "0"),
      minutes: String(minutes).padStart(2, "0"),
      seconds: String(seconds).padStart(2, "0"),
    });
  }

  return (
    <KpiCard title={t("analytics.countdownTitle")}>
      <strong className="analytics-kpi__value" aria-live="polite">
        {value}
      </strong>
    </KpiCard>
  );
}

export function LeaderboardBar({
  candidate,
}: Readonly<{
  candidate: AnalyticsSnapshot["categories"][number]["candidates"][number];
}>) {
  const t = useT();
  const percentage = Math.min(100, Math.max(0, candidate.percentage));
  return (
    <li className="analytics-leaderboard__candidate">
      <div className="analytics-leaderboard__candidate-meta">
        <strong>{candidate.name}</strong>
        <span>
          {t("analytics.candidateResult", {
            percentage: new Intl.NumberFormat("en", {
              maximumFractionDigits: 1,
            }).format(candidate.percentage),
            count: candidate.count,
          })}
        </span>
      </div>
      <div className="analytics-leaderboard__bar">
        <span
          className={
            candidate.isLeader
              ? "analytics-leaderboard__bar-fill analytics-leaderboard__bar-fill--leader"
              : "analytics-leaderboard__bar-fill"
          }
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-label={t("analytics.candidateBar", {
            name: candidate.name,
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        />
      </div>
      <div className="analytics-leaderboard__badges">
        {candidate.isLeader && (
          <span className="analytics-leaderboard__leader">
            {t("analytics.leader")}
          </span>
        )}
        {candidate.isTie && (
          <StatusBadge status="warning">{t("analytics.tie")}</StatusBadge>
        )}
      </div>
    </li>
  );
}

export function AuditDrawer({
  stationId,
  open,
  onClose,
}: Readonly<{
  stationId: string;
  open: boolean;
  onClose: () => void;
}>) {
  const t = useT();
  const auditQuery = useQuery({
    queryKey: ["station-analytics-audit", stationId],
    queryFn: () => analyticsApi.audit(stationId),
    enabled: open,
    retry: false,
  });
  const events: AnalyticsAudit["events"] = auditQuery.data?.events ?? [];

  if (!open) return null;

  return (
    <aside
      className="analytics-audit"
      role="region"
      aria-label={t("analytics.auditTitle")}
    >
      <header className="analytics-audit__header">
        <div>
          <h4>{t("analytics.auditTitle")}</h4>
          <p>{t("analytics.auditStationWide")}</p>
        </div>
        <M3Button variant="text" onClick={onClose}>
          {t("analytics.closeAudit")}
        </M3Button>
      </header>
      {auditQuery.isError ? (
        <M3Banner variant="error">{t(errorKey(auditQuery.error))}</M3Banner>
      ) : auditQuery.isPending ? (
        <SkeletonLoader label={t("analytics.loadingAudit")} count={2} />
      ) : (
        <>
          <p>{t("analytics.checkInCount", { count: events.length })}</p>
          {events.length === 0 ? (
            <p>{t("analytics.auditEmpty")}</p>
          ) : (
            <ol>
              {events.map((event, index) => (
                <li key={`${event.checkedInAt}-${index}`}>
                  <time dateTime={event.checkedInAt}>
                    {new Date(event.checkedInAt).toLocaleString("en-MW")}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </aside>
  );
}

export function CategoryLeaderboardCard({
  stationId,
  category,
}: Readonly<{
  stationId: string;
  category: AnalyticsSnapshot["categories"][number];
}>) {
  const t = useT();
  const [auditOpen, setAuditOpen] = useState(false);
  const auditId = `analytics-audit-${category.categoryId}`;
  return (
    <M3Card as="article" className="analytics-category">
      <header className="analytics-category__header">
        <h3>{category.title}</h3>
        <M3Button
          variant="text"
          aria-expanded={auditOpen}
          aria-controls={auditId}
          onClick={() => setAuditOpen((open) => !open)}
        >
          {t("analytics.viewAuditFor", { category: category.title })}
        </M3Button>
      </header>
      {category.candidates.length > 0 ? (
        <ol className="analytics-leaderboard">
          {category.candidates.map((candidate) => (
            <LeaderboardBar key={candidate.candidateId} candidate={candidate} />
          ))}
        </ol>
      ) : (
        <p>{t("analytics.noResults")}</p>
      )}
      <div id={auditId}>
        <AuditDrawer
          stationId={stationId}
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
        />
      </div>
    </M3Card>
  );
}

export function ExportMenu({ stationId }: Readonly<{ stationId: string }>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportCsv(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const csv = await analyticsApi.exportCsv(stationId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `station-${stationId.replace(/[^A-Za-z0-9_-]/g, "_")}-analytics.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setOpen(false);
    } catch (requestError) {
      setError(errorKey(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="analytics-export">
      <M3Button
        variant="outlined"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {t("analytics.exportMenu")}
      </M3Button>
      {open && (
        <div className="analytics-export__menu" role="group">
          <M3Button
            variant="text"
            loading={busy}
            disabled={busy}
            onClick={() => void exportCsv()}
          >
            {t("analytics.exportCsv")}
          </M3Button>
        </div>
      )}
      {error && <M3Banner variant="error">{t(error)}</M3Banner>}
    </div>
  );
}

export type StationAnalyticsProps = Readonly<{
  stationId: string;
  stationMode: StationDto["mode"];
  stationStatus: string;
  voteEndsAt?: string | null;
}>;

export function StationAnalytics({
  stationId,
  stationMode,
  stationStatus,
  voteEndsAt,
}: StationAnalyticsProps) {
  const t = useT();
  const visiblePollInterval = usePollingInterval(analyticsPollIntervalMs);
  const votingOpen = ["VOTE_OPEN", "VOTING_OPEN"].includes(
    stationStatus.toUpperCase(),
  );
  const snapshotQuery = useQuery({
    queryKey: ["station-analytics", stationId],
    queryFn: () => analyticsApi.snapshot(stationId),
    retry: false,
    refetchInterval: (query) =>
      getAnalyticsPollingInterval(
        visiblePollInterval !== false,
        votingOpen && query.state.data?.state !== "FINAL",
        query.state.fetchFailureCount,
      ),
    refetchIntervalInBackground: false,
  });
  const snapshot = snapshotQuery.data;
  const connectionState: ConnectionState = snapshotQuery.isError
    ? snapshot
      ? "reconnecting"
      : "offline"
    : snapshot
      ? "connected"
      : "reconnecting";
  const fallbackState =
    snapshot?.state ??
    (["VOTE_CLOSED", "VOTING_CLOSED", "ARCHIVED"].includes(
      stationStatus.toUpperCase(),
    )
      ? "FINAL"
      : votingOpen
        ? undefined
        : "WAITING");
  const isPending = snapshotQuery.isPending;

  return (
    <section className="station-analytics" aria-labelledby="analytics-title">
      <header className="station-analytics__header">
        <div>
          <h2 id="analytics-title">{t("analytics.title")}</h2>
          <ConnectionStatusBadge
            state={connectionState}
            lastUpdated={snapshot?.lastUpdated}
          />
        </div>
        <ExportMenu stationId={stationId} />
      </header>
      {snapshotQuery.error && (
        <M3Banner variant="error">{t(errorKey(snapshotQuery.error))}</M3Banner>
      )}
      {isPending ? (
        <SkeletonLoader label={t("analytics.loading")} count={3} />
      ) : fallbackState === "WAITING" ? (
        <M3Banner variant="info">{t("analytics.waitingForVoting")}</M3Banner>
      ) : snapshot ? (
        <>
          {snapshot.state === "FINAL" && (
            <M3Banner variant="info">{t("analytics.finalResults")}</M3Banner>
          )}
          <div className="station-analytics__kpis">
            <TurnoutGauge snapshot={snapshot} />
            <BallotsCastCard snapshot={snapshot} />
            <CountdownTimer snapshot={snapshot} voteEndsAt={voteEndsAt} />
          </div>
          <section
            className="station-analytics__leaderboards"
            aria-label={t("analytics.leaderboards")}
          >
            {snapshot.categories.map((category) => (
              <CategoryLeaderboardCard
                key={category.categoryId}
                stationId={stationId}
                category={category}
              />
            ))}
          </section>
          {snapshot.categories.length === 0 && (
            <p>{t("analytics.noCategories")}</p>
          )}
        </>
      ) : (
        <M3Banner variant="warning">
          {fallbackState === "FINAL"
            ? t("analytics.finalResults")
            : t("analytics.noSnapshot")}
        </M3Banner>
      )}
      {stationMode !== snapshot?.stationMode && snapshot && (
        <M3Banner variant="error">{t("errors.internal")}</M3Banner>
      )}
    </section>
  );
}
