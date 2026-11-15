"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Chip,
  EmptyState,
  M3Banner,
  M3Button,
  M3Card,
  M3TextField,
  SkeletonLoader,
  StatusBadge,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/Icon";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import type { HostDto, StationDto } from "@/lib/api/schemas";
import { stationsApi } from "@/lib/api/stations";
import { useT } from "@/lib/i18n";
import { discardStationDraft } from "@/lib/host/station-draft";
import { useStationDraft } from "@/lib/host/use-station-draft";
import { useCurrentTime } from "@/lib/host/use-current-time";

const filters = ["All", "Active", "Scheduled", "Past"] as const;
type StationFilter = (typeof filters)[number];

type StationDashboardProps = Readonly<{
  host: HostDto;
}>;

function statusStyle(
  status: string,
): "neutral" | "success" | "warning" | "error" {
  const normalized = status.toUpperCase();
  if (["VOTE_OPEN", "REGISTRATION_OPEN", "REG_OPEN"].includes(normalized)) {
    return "success";
  }
  if (
    ["DRAFT", "SCHEDULED", "REGISTRATION_CLOSED", "REG_CLOSED"].includes(
      normalized,
    )
  ) {
    return "warning";
  }
  if (["CANCELLED", "PURGED"].includes(normalized)) return "error";
  return "neutral";
}

function keyDate(station: StationDto): string | null {
  return (
    station.voteStartsAt ??
    station.regEndsAt ??
    station.voteEndsAt ??
    station.regStartsAt ??
    null
  );
}

function AccountWarningBanners({ host }: StationDashboardProps) {
  const t = useT();
  const now = useCurrentTime();
  const purgeTime = host.purgeAt ? Date.parse(host.purgeAt) : Number.NaN;
  const purgeDays = Number.isFinite(purgeTime) && now !== null
    ? Math.max(0, Math.ceil((purgeTime - now) / 86_400_000))
    : null;
  const lastLogin = host.lastLoginAt
    ? Date.parse(host.lastLoginAt)
    : Number.NaN;
  const lastLoginDate = new Date(lastLogin);
  const inactivityTime = new Date(
    lastLoginDate.getFullYear(),
    lastLoginDate.getMonth() + 5,
    lastLoginDate.getDate(),
    lastLoginDate.getHours(),
    lastLoginDate.getMinutes(),
    lastLoginDate.getSeconds(),
  );
  const inactivityDays = Number.isFinite(lastLogin) && now !== null
    ? Math.ceil((inactivityTime.getTime() - now) / 86_400_000)
    : null;

  return (
    <div
      className="station-dashboard__banners"
      aria-label={t("station.banners")}
    >
      {host.accountType === "TEMPORARY" && purgeDays !== null && (
        <M3Banner variant="warning">
          {t("station.temporaryPurgeWarning", { days: purgeDays })}
        </M3Banner>
      )}
      {host.accountType === "LONG_TERM" &&
        inactivityDays !== null &&
        inactivityDays <= 0 && (
          <M3Banner variant="warning">
            {t("station.inactivityWarning")}
          </M3Banner>
        )}
      {host.plan.toUpperCase() === "PAYMENT_REQUIRED" && (
        <M3Banner variant="error">{t("station.paymentRequired")}</M3Banner>
      )}
    </div>
  );
}

function StationCard({ station }: Readonly<{ station: StationDto }>) {
  const t = useT();
  const router = useRouter();
  const date = keyDate(station);
  const stationId = station.id ?? station.stationId;
  const count =
    station.mode === "CLOSED_VOTE"
      ? (station.registeredCount ?? station.approvedVoters ?? 0)
      : (station.ballotsCast ?? 0);

  return (
    <M3Card className="station-card">
      <button
        type="button"
        className="station-card__open"
        disabled={!stationId}
        onClick={() =>
          stationId &&
          router.push(`/host/stations/${encodeURIComponent(stationId)}/edit`)
        }
        aria-label={t("station.openStation", { name: station.name })}
      >
        <span className="station-card__title">{station.name}</span>
        <StatusBadge status={statusStyle(station.status)}>
          {t(`status.station.${station.status.toLowerCase()}`)}
        </StatusBadge>
        <span className="station-card__mode">
          {t(
            station.mode === "CLOSED_VOTE"
              ? "station.closedVote"
              : "station.publicPoll",
          )}
        </span>
        {date && (
          <time dateTime={date}>
            {t("station.keyDate")}: {new Date(date).toLocaleString()}
          </time>
        )}
        <span>
          {station.mode === "CLOSED_VOTE"
            ? t("station.registeredCount", { count })
            : t("station.ballotsCast", { count })}
        </span>
      </button>
    </M3Card>
  );
}

export function StationDashboard({ host }: StationDashboardProps) {
  const t = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<StationFilter>("All");
  const [search, setSearch] = useState("");
  const [draftActionError, setDraftActionError] = useState<string | null>(null);
  const { draft, error: draftError } = useStationDraft();
  const stations = useQuery({
    queryKey: ["host-stations", filter, search],
    queryFn: () => stationsApi.list({ filter, search }),
    retry: false,
  });

  const items = stations.data?.stations ?? [];
  const createStation = () => router.push("/host/stations/new");
  const resumeDraft = () => {
    if (!draft) return;
    const path = draft.stationId
      ? `/host/stations/${encodeURIComponent(draft.stationId)}/edit`
      : "/host/stations/new";
    router.push(`${path}?resume=1`);
  };
  const confirmDiscard = () => {
    try {
      discardStationDraft();
      setDraftActionError(null);
    } catch {
      setDraftActionError("station.draft.storageUnavailable");
    }
  };

  return (
    <main className="host-page station-dashboard">
      <div className="station-dashboard__header">
        <h1>{t("host.dashboardTitle")}</h1>
      </div>
      <AccountWarningBanners host={host} />
      {(draftError || draftActionError) && (
        <M3Banner variant="error">
          {t(draftActionError ?? draftError ?? "station.draft.invalid")}
        </M3Banner>
      )}
      {draft && (
        <ConfirmDialog
          open
          onClose={resumeDraft}
          onConfirm={confirmDiscard}
          title={t("station.resumeTitle")}
          description={t("station.resumeDescription")}
          cancelLabel={t("station.resumeDraft")}
          confirmLabel={t("station.discardDraft")}
        />
      )}
      {(stations.isPending ||
        items.length > 0 ||
        filter !== "All" ||
        search.length > 0) && (
        <div className="station-dashboard__controls">
          <div
            className="station-dashboard__filters"
            aria-label={t("station.filterBy")}
          >
            {filters.map((item) => (
              <Chip
                key={item}
                selected={filter === item}
                onClick={() => setFilter(item)}
              >
                {t(`station.filters.${item.toLowerCase()}`)}
              </Chip>
            ))}
          </div>
          <M3TextField
            label={t("station.search")}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </div>
      )}
      {stations.isPending ? (
        <SkeletonLoader label={t("station.loading")} count={3} />
      ) : stations.isError ? (
        <M3Banner variant="error">
          {t("errors.station.not_configured")}
        </M3Banner>
      ) : items.length === 0 && filter === "All" && search.length === 0 ? (
        <M3Card>
          <EmptyState
            title={t("host.emptyTitle")}
            description={t("host.emptyDescription")}
            icon={<Icon name="how_to_vote" />}
            action={
              <M3Button onClick={createStation}>
                {t("host.createSession")}
              </M3Button>
            }
          />
        </M3Card>
      ) : (
        <>
          {items.length > 0 ? (
            <div className="station-dashboard__grid">
              {items.map((station) => (
                <StationCard
                  key={station.id ?? station.stationId ?? station.publicId}
                  station={station}
                />
              ))}
            </div>
          ) : (
            <M3Card>
              <EmptyState
                title={t("station.noFilteredResults")}
                description={t("station.noFilteredResultsDescription")}
              />
            </M3Card>
          )}
        </>
      )}
      <FloatingActionButton
        label={t("navigation.floatingAction")}
        onClick={createStation}
        hidden={items.length === 0 || stations.isPending}
      />
    </main>
  );
}
