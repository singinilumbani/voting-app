"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  ConfirmDialog,
  M3ModalDialog,
  TypedConfirmDialog,
} from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/Icon";
import {
  CopyLinkField,
  DateTimeField,
  M3Banner,
  M3Button,
  M3Card,
  M3Select,
  NumberField,
  PageHeader,
  SkeletonLoader,
  StatusBadge,
  Tabs,
  Toggle,
} from "@/components/ui/primitives";
import type { StationDto } from "@/lib/api/schemas";
import { ApiError } from "@/lib/api/client";
import { stationsApi } from "@/lib/api/stations";
import { usePollingInterval } from "@/lib/polling";
import { useT } from "@/lib/i18n";
import { useCurrentTime } from "@/lib/host/use-current-time";
import { STATION_LIMITS } from "@/lib/shared/station-constants";
import { CandidateEditorDialog } from "./CandidateEditorDialog";
import { ApprovalQueue } from "./ApprovalQueue";
import { StationAnalytics } from "./StationAnalytics";
import { HostShell, SessionGate } from "./HostPages";

const LazyQRCode = dynamic(
  () => import("qrcode.react").then((module) => module.QRCodeSVG),
  { ssr: false },
);

function subscribeToAppOrigin(): () => void {
  return () => undefined;
}

function getAppOrigin(): string {
  return window.location.origin;
}

function getServerAppOrigin(): string {
  return "";
}

const tabDefinitions = [
  { id: "overview", labelKey: "station.detail.tabs.overview" },
  { id: "candidates", labelKey: "station.detail.tabs.candidates" },
  { id: "voters", labelKey: "station.detail.tabs.voters" },
  { id: "analytics", labelKey: "station.detail.tabs.analytics" },
  { id: "settings", labelKey: "station.detail.tabs.settings" },
] as const;

export type StationDetailTab = (typeof tabDefinitions)[number]["id"];

const statusKey: Record<string, string> = {
  DRAFT: "status.station.draft",
  SCHEDULED: "status.station.scheduled",
  REG_OPEN: "status.station.reg_open",
  REGISTRATION_OPEN: "status.station.registration_open",
  REG_CLOSED: "status.station.reg_closed",
  REGISTRATION_CLOSED: "status.station.registration_closed",
  VOTE_OPEN: "status.station.vote_open",
  VOTING_OPEN: "status.station.vote_open",
  VOTE_CLOSED: "status.station.vote_closed",
  VOTING_CLOSED: "status.station.vote_closed",
  ARCHIVED: "status.station.archived",
  PURGED: "status.station.purged",
  CANCELLED: "status.station.cancelled",
  UNKNOWN: "status.station.unknown",
};

const hostActivityKeys: Record<string, string> = {
  CANDIDATE_ADDED: "station.detail.activityEvents.CANDIDATE_ADDED",
  CANDIDATE_EDITED: "station.detail.activityEvents.CANDIDATE_EDITED",
  REGISTRATION_EXTENDED: "station.detail.activityEvents.REGISTRATION_EXTENDED",
  VOTER_CAP_INCREASED: "station.detail.activityEvents.VOTER_CAP_INCREASED",
  VOTING_STARTED: "station.detail.activityEvents.VOTING_STARTED",
  STATION_CANCELLED: "station.detail.activityEvents.STATION_CANCELLED",
  VOTER_APPROVED: "station.detail.activityEvents.VOTER_APPROVED",
  VOTER_REJECTED: "station.detail.activityEvents.VOTER_REJECTED",
  VOTER_REVOKED: "station.detail.activityEvents.VOTER_REVOKED",
  TOKEN_REISSUED: "station.detail.activityEvents.TOKEN_REISSUED",
  PHONE_BLOCKED: "station.detail.activityEvents.PHONE_BLOCKED",
};

const startVotingSchema = z.object({
  startMode: z.enum(["NOW", "SCHEDULED"]),
  startsAt: z.string(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(STATION_LIMITS.voting.minimumDurationMinutes)
    .max(STATION_LIMITS.voting.maximumDurationMinutes),
});

const extendRegistrationSchema = z.object({
  additionalHours: z.coerce.number().int().min(1).max(24),
});

const stationSettingsSchema = z.object({
  resultsVisibility: z.enum(["IMMEDIATE", "CONCEALED"]),
  allowAbstain: z.boolean(),
  mobileOnly: z.boolean(),
  voterCap: z.coerce
    .number()
    .int()
    .min(STATION_LIMITS.registration.minimumVoters)
    .max(STATION_LIMITS.registration.maximumVoters)
    .optional(),
});

function normalizedStatus(station: StationDto): string {
  return station.status.toUpperCase();
}

function dateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function stationIdOf(station: StationDto): string {
  return station.id ?? station.stationId ?? "";
}

function statusTone(
  status: string,
): "neutral" | "success" | "warning" | "error" {
  if (
    ["REG_OPEN", "REGISTRATION_OPEN", "VOTE_OPEN", "VOTING_OPEN"].includes(
      status,
    )
  ) {
    return "success";
  }
  if (
    ["DRAFT", "SCHEDULED", "REG_CLOSED", "REGISTRATION_CLOSED"].includes(status)
  ) {
    return "warning";
  }
  if (["CANCELLED", "PURGED"].includes(status)) return "error";
  return "neutral";
}

function activityType(entry: Record<string, unknown>): string {
  for (const field of ["eventType", "action", "type"]) {
    const value = entry[field];
    if (typeof value === "string") return value.toUpperCase();
  }
  return "";
}

function entryTimestamp(entry: Record<string, unknown>): string | null {
  for (const field of ["createdAt", "timestamp"]) {
    const value = entry[field];
    if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
      return value;
    }
  }
  return null;
}

function RouteTabs({
  stationId,
  activeTab,
  stationMode,
}: Readonly<{
  stationId: string;
  activeTab: StationDetailTab;
  stationMode: StationDto["mode"];
}>) {
  const t = useT();
  const visibleTabs = tabDefinitions.filter(
    (tab) => tab.id !== "voters" || stationMode === "CLOSED_VOTE",
  );
  return (
    <Tabs
      className="station-detail__tabs"
      activeTab={activeTab}
      label={t("station.detail.tabNavigation")}
      tabs={visibleTabs.map((tab) => ({
        id: tab.id,
        label: t(tab.labelKey),
        href: `/host/stations/${encodeURIComponent(stationId)}/${tab.id}`,
        content: null,
      }))}
    />
  );
}

function ShareLinkCard({ publicId }: Readonly<{ publicId: string }>) {
  const t = useT();
  const appOrigin = useSyncExternalStore(
    subscribeToAppOrigin,
    getAppOrigin,
    getServerAppOrigin,
  );
  const link = appOrigin
    ? new URL(`/s/${encodeURIComponent(publicId)}`, appOrigin).toString()
    : null;
  return (
    <M3Card className="station-detail__share">
      <h2>{t("station.detail.shareTitle")}</h2>
      {link ? (
        <>
          <CopyLinkField
            label={t("station.detail.publicLink")}
            value={link}
            copyLabel={t("station.detail.copyLink")}
            copiedLabel={t("station.detail.copiedLink")}
            copyErrorLabel={t("station.detail.copyError")}
          />
          <div className="station-detail__qr">
            <LazyQRCode
              value={link}
              size={176}
              aria-label={t("station.detail.qrLabel")}
            />
          </div>
        </>
      ) : (
        <SkeletonLoader label={t("station.loading")} />
      )}
    </M3Card>
  );
}

function PhaseTimeline({ station }: Readonly<{ station: StationDto }>) {
  const t = useT();
  const status = normalizedStatus(station);
  const activePhase = [
    "VOTE_CLOSED",
    "VOTING_CLOSED",
    "ARCHIVED",
    "PURGED",
  ].includes(status)
    ? "results"
    : [
          "REG_CLOSED",
          "REGISTRATION_CLOSED",
          "VOTE_OPEN",
          "VOTING_OPEN",
        ].includes(status)
      ? "voting"
      : "registration";
  const phases = ["registration", "voting", "results"] as const;
  const activeIndex = phases.indexOf(activePhase);

  return (
    <M3Card className="station-detail__timeline">
      <h2>{t("station.detail.phaseTimeline")}</h2>
      <ol>
        {phases.map((phase, index) => {
          const phaseState =
            index < activeIndex
              ? "complete"
              : index === activeIndex
                ? "current"
                : "upcoming";
          return (
            <li
              key={phase}
              className={`station-phase station-phase--${phaseState}`}
              aria-current={phaseState === "current" ? "step" : undefined}
            >
              <span>{t(`station.detail.phase.${phase}`)}</span>
              <small>{t(`station.detail.phaseState.${phaseState}`)}</small>
            </li>
          );
        })}
      </ol>
    </M3Card>
  );
}

function QuickStats({ station }: Readonly<{ station: StationDto }>) {
  const t = useT();
  const stats =
    station.mode === "CLOSED_VOTE"
      ? [
          {
            label: t("station.detail.registered", {
              count: station.registeredCount ?? 0,
            }),
            value: station.registeredCount ?? 0,
          },
          {
            label: t("station.detail.approved", {
              count: station.approvedVoters ?? 0,
            }),
            value: station.approvedVoters ?? 0,
          },
          {
            label: t("station.detail.ballots", {
              count: station.ballotsCast ?? 0,
            }),
            value: station.ballotsCast ?? 0,
          },
          {
            label: t("station.detail.voterCap"),
            value: station.voterCap ?? 0,
          },
        ]
      : [
          {
            label: t("station.detail.ballots", {
              count: station.ballotsCast ?? 0,
            }),
            value: station.ballotsCast ?? 0,
          },
        ];

  return (
    <M3Card className="station-detail__stats">
      <h2>{t("station.detail.quickStats")}</h2>
      <dl>
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{new Intl.NumberFormat().format(stat.value)}</dd>
          </div>
        ))}
      </dl>
    </M3Card>
  );
}

function StationActivity({ stationId }: Readonly<{ stationId: string }>) {
  const t = useT();
  const activity = useQuery({
    queryKey: ["station-activity", stationId],
    queryFn: () => stationsApi.activityLog(stationId),
    staleTime: 15_000,
    retry: false,
  });
  const entries = (activity.data?.activity ?? []).flatMap((entry) => {
    const kind = activityType(entry);
    const translationKey = hostActivityKeys[kind];
    const timestamp = entryTimestamp(entry);
    if (!translationKey) return [];
    return [{ kind, translationKey, timestamp }];
  });

  return (
    <M3Card className="station-detail__activity">
      <h2>{t("station.detail.activityTitle")}</h2>
      {activity.isError ? (
        <p role="alert">{t("station.detail.activityUnavailable")}</p>
      ) : activity.isPending ? (
        <SkeletonLoader label={t("station.loading")} count={2} />
      ) : entries.length === 0 ? (
        <p>{t("station.detail.activityEmpty")}</p>
      ) : (
        <ol aria-label={t("station.detail.activityTitle")}>
          {entries.map((entry, index) => (
            <li key={`${entry.kind}-${entry.timestamp ?? index}`}>
              <span>{t(entry.translationKey)}</span>
              {entry.timestamp && (
                <time dateTime={entry.timestamp}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
              )}
            </li>
          ))}
        </ol>
      )}
    </M3Card>
  );
}

function OverviewTab({ station }: Readonly<{ station: StationDto }>) {
  return (
    <div className="station-detail__overview">
      <PhaseTimeline station={station} />
      <QuickStats station={station} />
      <ShareLinkCard publicId={station.publicId} />
      <StationActivity stationId={stationIdOf(station)} />
    </div>
  );
}

type CandidateDto = NonNullable<
  NonNullable<StationDto["categories"]>[number]["candidates"]
>[number];

function CandidatesTab({
  station,
  onChange,
}: Readonly<{
  station: StationDto;
  onChange: (station: StationDto) => void;
}>) {
  const t = useT();
  const stationId = stationIdOf(station);
  const status = normalizedStatus(station);
  const canEdit =
    status === "DRAFT" ||
    status === "REG_OPEN" ||
    status === "REGISTRATION_OPEN";
  const canRemove = status === "DRAFT";
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateDto | undefined>();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [draftImageDataUrl, setDraftImageDataUrl] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CandidateDto | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  function closeEditor() {
    setDialogCategoryId(null);
    setCandidate(undefined);
    setName("");
    setImageUrl(null);
    setDraftImageDataUrl(undefined);
    setError(null);
  }

  function openEditor(categoryId: string, selected?: CandidateDto) {
    setDialogCategoryId(categoryId);
    setCandidate(selected);
    setName(selected?.name ?? "");
    setImageUrl(selected?.imageUrl ?? selected?.picture ?? null);
    setDraftImageDataUrl(undefined);
    setError(null);
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialogCategoryId || !name.trim() || uploading) {
      setError("station.validation.candidateName");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        ...(candidate
          ? { picture: imageUrl }
          : imageUrl
            ? { picture: imageUrl }
            : {}),
      };
      const response = candidate
        ? await stationsApi.updateCandidate(stationId, candidate.id, input)
        : await stationsApi.createCandidate(stationId, dialogCategoryId, input);
      const saved = response.candidate;
      const categories = (station.categories ?? []).map((category) => {
        if (category.id !== dialogCategoryId) return category;
        const candidates = category.candidates ?? [];
        return {
          ...category,
          candidates: candidate
            ? candidates.map((item) =>
                item.id === candidate.id ? saved : item,
              )
            : [...candidates, saved],
        };
      });
      onChange({ ...station, categories });
      closeEditor();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.key : "errors.internal");
    } finally {
      setBusy(false);
    }
  }

  async function removeCandidate() {
    if (!deleteCandidate) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await stationsApi.deleteCandidate(stationId, deleteCandidate.id);
      onChange({
        ...station,
        categories: (station.categories ?? []).map((category) => ({
          ...category,
          candidates: (category.candidates ?? []).filter(
            (item) => item.id !== deleteCandidate.id,
          ),
        })),
      });
      setDeleteCandidate(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.key : "errors.internal");
      setDeleteCandidate(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className="station-detail__candidates">
      {!canEdit && (
        <M3Banner variant="warning">
          <strong>{t("station.detail.readOnlyTitle")}</strong>{" "}
          {t("station.detail.candidateLock")}
        </M3Banner>
      )}
      {error && <M3Banner variant="error">{t(error)}</M3Banner>}
      {(station.categories ?? []).map((category) => (
        <M3Card key={category.id} className="station-detail__position">
          <header>
            <h2>{category.title}</h2>
            {canEdit && (
              <M3Button
                type="button"
                variant="tonal"
                leadingIcon={<Icon name="add" />}
                aria-label={t("station.addCandidateTo", {
                  name: category.title,
                })}
                onClick={() => openEditor(category.id)}
              >
                {t("station.detail.addCandidate")}
              </M3Button>
            )}
          </header>
          <div className="station-detail__candidate-grid">
            {(category.candidates ?? []).map((item) => {
              const image = item.imageUrl ?? item.picture;
              return (
                <article key={item.id} className="station-detail__candidate">
                  {image && (
                    <Image
                      src={image}
                      alt={t("station.candidateImage", { name: item.name })}
                      width={128}
                      height={128}
                      unoptimized
                    />
                  )}
                  <h3>{item.name}</h3>
                  {canEdit && (
                    <M3Button
                      type="button"
                      variant="text"
                      leadingIcon={<Icon name="edit" />}
                      aria-label={t("station.detail.editCandidateFor", {
                        name: item.name,
                      })}
                      onClick={() => openEditor(category.id, item)}
                    >
                      {t("common.edit")}
                    </M3Button>
                  )}
                  {canRemove && (
                    <M3Button
                      type="button"
                      variant="destructive"
                      aria-label={t("station.detail.removeCandidateFor", {
                        name: item.name,
                      })}
                      onClick={() => setDeleteCandidate(item)}
                    >
                      {t("station.detail.removeCandidate")}
                    </M3Button>
                  )}
                  {!canEdit && (
                    <span className="station-detail__lock">
                      {t("station.detail.candidateReadOnly")}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </M3Card>
      ))}
      <CandidateEditorDialog
        open={dialogCategoryId !== null}
        stationId={stationId}
        editing={candidate !== undefined}
        name={name}
        imageUrl={imageUrl}
        draftImageDataUrl={draftImageDataUrl}
        busy={busy}
        uploading={uploading}
        error={error ? t(error) : undefined}
        onNameChange={setName}
        onImageUrlChange={setImageUrl}
        onDraftImageChange={setDraftImageDataUrl}
        onUploadStateChange={setUploading}
        onClose={closeEditor}
        onSave={(event) => void saveCandidate(event)}
      />
      <ConfirmDialog
        open={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={() => void removeCandidate()}
        title={t("station.removeCandidateTitle")}
        description={t("station.removeCandidateDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={deleteBusy ? t("station.loading") : t("common.delete")}
      />
    </section>
  );
}

type StationSettingsValue = Readonly<{
  resultsVisibility: "IMMEDIATE" | "CONCEALED";
  allowAbstain: boolean;
  mobileOnly: boolean;
  voterCap: string;
}>;

function SettingsTab({
  station,
  error,
  busy,
  maxAdditionalHours,
  onSave,
  onExtend,
  onCancel,
}: Readonly<{
  station: StationDto;
  error: string | null;
  busy: boolean;
  maxAdditionalHours: number;
  onSave: (value: StationSettingsValue) => void;
  onExtend: () => void;
  onCancel: () => void;
}>) {
  const t = useT();
  const status = normalizedStatus(station);
  const registrationOpened = status !== "DRAFT";
  const votingStarted = [
    "VOTE_OPEN",
    "VOTING_OPEN",
    "VOTE_CLOSED",
    "VOTING_CLOSED",
    "ARCHIVED",
    "PURGED",
  ].includes(status);
  const [resultsVisibility, setResultsVisibility] = useState<
    "IMMEDIATE" | "CONCEALED"
  >(station.resultsVisibility ?? "CONCEALED");
  const [allowAbstain, setAllowAbstain] = useState(
    station.allowAbstain ?? false,
  );
  const [mobileOnly, setMobileOnly] = useState(station.mobileOnly ?? false);
  const [voterCap, setVoterCap] = useState(
    String(station.voterCap ?? STATION_LIMITS.registration.defaultVoters),
  );
  const canCancel = ![
    "VOTE_CLOSED",
    "VOTING_CLOSED",
    "ARCHIVED",
    "PURGED",
    "CANCELLED",
  ].includes(status);
  const canExtend = status === "REG_OPEN" || status === "REGISTRATION_OPEN";

  return (
    <div className="station-detail__settings">
      <M3Card>
        <h2>{t("station.detail.settingsTitle")}</h2>
        {error && <M3Banner variant="error">{t(error)}</M3Banner>}
        <form
          className="station-detail__settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              resultsVisibility,
              allowAbstain,
              mobileOnly,
              voterCap,
            });
          }}
        >
          <M3Select
            label={t("station.detail.resultsVisibility")}
            value={resultsVisibility}
            disabled={votingStarted}
            onChange={(event) =>
              setResultsVisibility(
                event.currentTarget.value === "IMMEDIATE"
                  ? "IMMEDIATE"
                  : "CONCEALED",
              )
            }
            options={[
              {
                value: "IMMEDIATE",
                label: t("station.detail.resultsImmediate"),
              },
              {
                value: "CONCEALED",
                label: t("station.detail.resultsConcealed"),
              },
            ]}
            helperText={
              votingStarted ? t("station.detail.resultsLocked") : undefined
            }
          />
          <Toggle
            label={t("station.allowAbstain")}
            checked={allowAbstain}
            disabled={registrationOpened}
            description={
              registrationOpened
                ? t("station.detail.votingOptionsLocked")
                : undefined
            }
            onCheckedChange={setAllowAbstain}
          />
          <Toggle
            label={t("station.mobileOnly")}
            checked={mobileOnly}
            disabled={registrationOpened}
            description={
              registrationOpened
                ? t("station.detail.votingOptionsLocked")
                : undefined
            }
            onCheckedChange={setMobileOnly}
          />
          {station.mode === "CLOSED_VOTE" && (
            <NumberField
              label={t("station.detail.voterCapIncrease")}
              value={voterCap}
              min={(station.voterCap ?? 0) + 1}
              max={STATION_LIMITS.registration.maximumVoters}
              helperText={t("station.detail.voterCapIncreaseHint")}
              disabled={votingStarted}
              onChange={(event) => setVoterCap(event.currentTarget.value)}
            />
          )}
          <M3Button type="submit" loading={busy}>
            {t("station.detail.saveSettings")}
          </M3Button>
        </form>
      </M3Card>
      {canExtend && (
        <M3Card className="station-detail__extend">
          <h2>{t("station.detail.extendTitle")}</h2>
          <p>{t("station.detail.extendDescription")}</p>
          <M3Button
            type="button"
            variant="outlined"
            disabled={maxAdditionalHours < 1}
            onClick={onExtend}
          >
            {t("station.detail.extendAction")}
          </M3Button>
        </M3Card>
      )}
      {canCancel && (
        <M3Card className="station-detail__danger">
          <h2>{t("station.detail.dangerZone")}</h2>
          <M3Button type="button" variant="destructive" onClick={onCancel}>
            {t("station.detail.cancelStation")}
          </M3Button>
        </M3Card>
      )}
    </div>
  );
}

function PlaceholderTab({ children }: Readonly<{ children: ReactNode }>) {
  return <M3Card className="station-detail__placeholder">{children}</M3Card>;
}

export function StationDetail({
  stationId,
  activeTab,
}: Readonly<{ stationId: string; activeTab: StationDetailTab }>) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollingInterval = usePollingInterval(15_000);
  const now = useCurrentTime();
  const stationQuery = useQuery({
    queryKey: ["station-detail", stationId],
    queryFn: () => stationsApi.get(stationId),
    retry: false,
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [additionalHours, setAdditionalHours] = useState("1");
  const [startOpen, setStartOpen] = useState(false);
  const [zeroVotersOpen, setZeroVotersOpen] = useState(false);
  const [startMode, setStartMode] = useState<"NOW" | "SCHEDULED">("NOW");
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("720");
  const [pendingStart, setPendingStart] = useState<{
    warningKey: string;
    count: number;
  } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [typedCancelOpen, setTypedCancelOpen] = useState(false);
  const station = stationQuery.data?.station;

  function replaceStation(updated: StationDto) {
    queryClient.setQueryData(["station-detail", stationId], {
      station: updated,
    });
    void queryClient.invalidateQueries({ queryKey: ["host-stations"] });
    void queryClient.invalidateQueries({
      queryKey: ["station-activity", stationId],
    });
  }

  function fail(errorValue: unknown) {
    setError(
      errorValue instanceof ApiError ? errorValue.key : "errors.internal",
    );
  }

  function openStartDialog() {
    if (!station) return;
    if (
      normalizedStatus(station) === "REG_CLOSED" &&
      station.approvedVoters === 0
    ) {
      setZeroVotersOpen(true);
      return;
    }
    setStartMode(station.scheduled ? "SCHEDULED" : "NOW");
    setStartsAt(
      station.voteStartsAt
        ? dateTimeInput(new Date(station.voteStartsAt))
        : dateTimeInput(
            station.regEndsAt ? new Date(station.regEndsAt) : new Date(),
          ),
    );
    setDurationMinutes(
      String(
        station.votingDurationMinutes ??
          STATION_LIMITS.voting.defaultDurationMinutes,
      ),
    );
    setPendingStart(null);
    setError(null);
    setStartOpen(true);
  }

  async function submitStartVoting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = startVotingSchema.safeParse({
      startMode,
      startsAt,
      durationMinutes,
    });
    if (!parsed.success) {
      setError("station.validation.votingDuration");
      return;
    }
    let startsAtIso: string | undefined;
    if (parsed.data.startMode === "SCHEDULED") {
      const scheduledTime = new Date(parsed.data.startsAt);
      const minTime = station?.regEndsAt
        ? Date.parse(station.regEndsAt)
        : Date.now();
      const maxTime =
        minTime + STATION_LIMITS.voting.maximumScheduledDays * 86_400_000;
      if (
        Number.isNaN(scheduledTime.getTime()) ||
        scheduledTime.getTime() < minTime ||
        scheduledTime.getTime() > maxTime
      ) {
        setError("station.validation.scheduledStart");
        return;
      }
      startsAtIso = scheduledTime.toISOString();
    }
    setBusy(true);
    setError(null);
    try {
      await stationsApi.configureVoting(stationId, {
        startMode: parsed.data.startMode,
        ...(startsAtIso ? { startsAt: startsAtIso } : {}),
        durationMinutes: parsed.data.durationMinutes,
      });
      const response = await stationsApi.startVoting(stationId);
      if (response.requiresConfirmation) {
        setPendingStart({
          warningKey: response.warningKey,
          count: response.pendingCount,
        });
      } else {
        replaceStation(response.station);
        setStartOpen(false);
      }
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function confirmStartVoting() {
    setBusy(true);
    setError(null);
    try {
      const response = await stationsApi.startVoting(stationId, true);
      if (response.requiresConfirmation) {
        setError("errors.internal");
      } else {
        replaceStation(response.station);
        setPendingStart(null);
        setStartOpen(false);
      }
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const currentRegistrationHours = (() => {
    if (!station) return 0;
    const started = station.regStartsAt
      ? Date.parse(station.regStartsAt)
      : Number.NaN;
    const ends = station.regEndsAt ? Date.parse(station.regEndsAt) : Number.NaN;
    if (Number.isFinite(started) && Number.isFinite(ends) && ends >= started) {
      return (ends - started) / 3_600_000;
    }
    return station.registrationDurationHours ?? 12;
  })();
  const maxAdditionalHours = Math.max(
    0,
    Math.floor(24 - currentRegistrationHours + Number.EPSILON),
  );

  async function extendRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = extendRegistrationSchema.safeParse({
      additionalHours,
    });
    if (!parsed.success || parsed.data.additionalHours > maxAdditionalHours) {
      setError("station.validation.registration");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await stationsApi.extendRegistration(stationId, {
        additionalHours: parsed.data.additionalHours,
      });
      replaceStation(response.station);
      setExtendOpen(false);
      setNotice("station.detail.settingsSaved");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(value: StationSettingsValue) {
    if (!station) return;
    const parsed = stationSettingsSchema.safeParse({
      ...value,
      voterCap: station.mode === "CLOSED_VOTE" ? value.voterCap : undefined,
    });
    if (!parsed.success) {
      setError("station.validation.registration");
      return;
    }
    const currentCap = station.voterCap ?? 0;
    let returnedWarning: string | undefined;
    if (
      station.mode === "CLOSED_VOTE" &&
      parsed.data.voterCap !== undefined &&
      parsed.data.voterCap !== currentCap &&
      parsed.data.voterCap <= currentCap
    ) {
      setError("station.validation.voterCapIncrease");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let updated = station;
      if (
        station.mode === "CLOSED_VOTE" &&
        parsed.data.voterCap !== undefined &&
        parsed.data.voterCap > currentCap
      ) {
        const response = await stationsApi.updateVoterCap(stationId, {
          voterCap: parsed.data.voterCap,
        });
        updated = response.station;
        returnedWarning = response.warningKey;
      }
      const status = normalizedStatus(station);
      const hasOpenedRegistration = status !== "DRAFT";
      const hasStartedVoting = [
        "VOTE_OPEN",
        "VOTING_OPEN",
        "VOTE_CLOSED",
        "VOTING_CLOSED",
        "ARCHIVED",
        "PURGED",
      ].includes(status);
      const changes: {
        resultsVisibility?: "IMMEDIATE" | "CONCEALED";
        allowAbstain?: boolean;
        mobileOnly?: boolean;
      } = {};
      if (
        !hasStartedVoting &&
        parsed.data.resultsVisibility !== station.resultsVisibility
      ) {
        changes.resultsVisibility = parsed.data.resultsVisibility;
      }
      if (
        !hasOpenedRegistration &&
        parsed.data.allowAbstain !== station.allowAbstain
      ) {
        changes.allowAbstain = parsed.data.allowAbstain;
      }
      if (
        !hasOpenedRegistration &&
        parsed.data.mobileOnly !== station.mobileOnly
      ) {
        changes.mobileOnly = parsed.data.mobileOnly;
      }
      if (Object.keys(changes).length > 0) {
        const response = await stationsApi.update(stationId, changes);
        updated = response.station;
      }
      replaceStation(updated);
      setNotice(returnedWarning ?? "station.detail.settingsSaved");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  async function cancelStation() {
    setBusy(true);
    setError(null);
    try {
      const response = await stationsApi.cancel(
        stationId,
        station &&
          ["VOTE_OPEN", "VOTING_OPEN"].includes(normalizedStatus(station))
          ? "CANCEL"
          : undefined,
      );
      replaceStation(response.station);
      setCancelOpen(false);
      setTypedCancelOpen(false);
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  function openExtendDialog() {
    setAdditionalHours("1");
    setError(null);
    setExtendOpen(true);
  }

  function primaryAction() {
    if (!station) return;
    const status = normalizedStatus(station);
    if (status === "DRAFT") {
      router.push(`/host/stations/${encodeURIComponent(stationId)}/edit`);
    } else if (status === "REG_OPEN" || status === "REGISTRATION_OPEN") {
      openExtendDialog();
    } else if (status === "REG_CLOSED" || status === "REGISTRATION_CLOSED") {
      openStartDialog();
    } else if (
      [
        "VOTE_OPEN",
        "VOTING_OPEN",
        "VOTE_CLOSED",
        "VOTING_CLOSED",
        "ARCHIVED",
      ].includes(status)
    ) {
      router.push(`/host/stations/${encodeURIComponent(stationId)}/analytics`);
    } else {
      router.push("/host");
    }
  }

  if (stationQuery.isPending) {
    return <SkeletonLoader label={t("station.loading")} count={4} />;
  }
  if (stationQuery.isError || !station) {
    const queryError = stationQuery.error;
    return (
      <main className="host-page">
        <M3Banner variant="error">
          {queryError instanceof ApiError
            ? t(queryError.key)
            : t("station.detail.loadError")}
        </M3Banner>
      </main>
    );
  }

  const status = normalizedStatus(station);
  const primaryLabel =
    status === "DRAFT"
      ? "station.detail.primary.edit"
      : status === "REG_OPEN" || status === "REGISTRATION_OPEN"
        ? "station.detail.primary.extendRegistration"
        : status === "REG_CLOSED" || status === "REGISTRATION_CLOSED"
          ? "station.detail.primary.startVoting"
          : [
                "VOTE_OPEN",
                "VOTING_OPEN",
                "VOTE_CLOSED",
                "VOTING_CLOSED",
                "ARCHIVED",
              ].includes(status)
            ? "station.detail.primary.viewResults"
            : "station.detail.primary.backToStations";
  const canCancel = ![
    "VOTE_CLOSED",
    "VOTING_CLOSED",
    "ARCHIVED",
    "PURGED",
    "CANCELLED",
  ].includes(status);
  const scheduledMin = station.regEndsAt
    ? dateTimeInput(new Date(station.regEndsAt))
    : dateTimeInput(new Date(now ?? 0));
  const scheduledMax = dateTimeInput(
    new Date(
      (station.regEndsAt ? Date.parse(station.regEndsAt) : (now ?? 0)) +
        STATION_LIMITS.voting.maximumScheduledDays * 86_400_000,
    ),
  );

  return (
    <main className="host-page station-detail">
      <PageHeader
        title={station.name}
        actions={
          <div className="station-detail__header-actions">
            <StatusBadge status={statusTone(status)}>
              {t(statusKey[status] ?? "status.station.unknown")}
            </StatusBadge>
            <M3Button
              type="button"
              onClick={primaryAction}
              disabled={
                (status === "REG_OPEN" || status === "REGISTRATION_OPEN") &&
                maxAdditionalHours < 1
              }
            >
              {t(primaryLabel)}
            </M3Button>
          </div>
        }
      />
      {error && <M3Banner variant="error">{t(error)}</M3Banner>}
      {notice && <M3Banner variant="info">{t(notice)}</M3Banner>}
      <RouteTabs
        stationId={stationId}
        activeTab={activeTab}
        stationMode={station.mode}
      />
      {activeTab === "overview" && <OverviewTab station={station} />}
      {activeTab === "candidates" && (
        <CandidatesTab
          station={station}
          onChange={(updated) => replaceStation(updated)}
        />
      )}
      {activeTab === "voters" &&
        (station.mode === "CLOSED_VOTE" ? (
          <ApprovalQueue
            stationId={stationId}
            stationStatus={status}
            voterCap={station.voterCap}
          />
        ) : (
          <PlaceholderTab>
            {t("station.detail.votersPublicPoll")}
          </PlaceholderTab>
        ))}
      {activeTab === "analytics" && (
        <StationAnalytics
          stationId={stationId}
          stationMode={station.mode}
          stationStatus={status}
          voteEndsAt={station.voteEndsAt}
        />
      )}
      {activeTab === "settings" && (
        <SettingsTab
          station={station}
          error={error}
          busy={busy}
          maxAdditionalHours={maxAdditionalHours}
          onSave={(value) => void saveSettings(value)}
          onExtend={openExtendDialog}
          onCancel={() => {
            if (["VOTE_OPEN", "VOTING_OPEN"].includes(status)) {
              setTypedCancelOpen(true);
            } else {
              setCancelOpen(true);
            }
          }}
        />
      )}
      <M3ModalDialog
        open={startOpen}
        onClose={() => {
          setStartOpen(false);
          setPendingStart(null);
        }}
        title={t("station.detail.startVotingTitle")}
        actions={
          pendingStart ? (
            <>
              <M3Button
                variant="text"
                onClick={() => {
                  setStartOpen(false);
                  setPendingStart(null);
                }}
              >
                {t("common.cancel")}
              </M3Button>
              <M3Button
                loading={busy}
                onClick={() => void confirmStartVoting()}
              >
                {t("station.detail.confirmStartVoting")}
              </M3Button>
            </>
          ) : (
            <>
              <M3Button variant="text" onClick={() => setStartOpen(false)}>
                {t("common.cancel")}
              </M3Button>
              <M3Button
                type="submit"
                form="station-start-voting-form"
                loading={busy}
              >
                {t("station.detail.startVotingTitle")}
              </M3Button>
            </>
          )
        }
      >
        <p>{t("station.detail.startVotingDescription")}</p>
        {pendingStart && (
          <M3Banner variant="warning">
            {t(pendingStart.warningKey)}{" "}
            {t("station.detail.pendingWarning", {
              count: pendingStart.count,
            })}
          </M3Banner>
        )}
        {error && <p role="alert">{t(error)}</p>}
        <form
          id="station-start-voting-form"
          className="station-detail__dialog-form"
          onSubmit={(event) => void submitStartVoting(event)}
        >
          <fieldset>
            <legend>{t("station.detail.votingStart")}</legend>
            <label>
              <input
                type="radio"
                name="station-start-mode"
                checked={startMode === "NOW"}
                disabled={pendingStart !== null}
                onChange={() => setStartMode("NOW")}
              />
              {t("station.detail.openNow")}
            </label>
            <label>
              <input
                type="radio"
                name="station-start-mode"
                checked={startMode === "SCHEDULED"}
                disabled={pendingStart !== null}
                onChange={() => setStartMode("SCHEDULED")}
              />
              {t("station.detail.scheduleStart")}
            </label>
          </fieldset>
          {startMode === "SCHEDULED" && (
            <DateTimeField
              label={t("station.detail.scheduledStart")}
              value={startsAt}
              min={scheduledMin}
              max={scheduledMax}
              disabled={pendingStart !== null}
              onChange={(event) => setStartsAt(event.currentTarget.value)}
            />
          )}
          <NumberField
            label={t("station.detail.votingDuration")}
            value={durationMinutes}
            min={STATION_LIMITS.voting.minimumDurationMinutes}
            max={STATION_LIMITS.voting.maximumDurationMinutes}
            disabled={pendingStart !== null}
            onChange={(event) => setDurationMinutes(event.currentTarget.value)}
          />
        </form>
      </M3ModalDialog>
      <M3ModalDialog
        open={zeroVotersOpen}
        onClose={() => setZeroVotersOpen(false)}
        title={t("station.detail.zeroVotersTitle")}
        actions={
          <>
            <M3Button variant="text" onClick={() => setZeroVotersOpen(false)}>
              {t("common.close")}
            </M3Button>
            {canCancel && (
              <M3Button
                variant="destructive"
                onClick={() => {
                  setZeroVotersOpen(false);
                  setCancelOpen(true);
                }}
              >
                {t("station.detail.cancelStation")}
              </M3Button>
            )}
          </>
        }
      >
        <p>{t("station.detail.zeroVotersDescription")}</p>
      </M3ModalDialog>
      <M3ModalDialog
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title={t("station.detail.extendTitle")}
        actions={
          <>
            <M3Button variant="text" onClick={() => setExtendOpen(false)}>
              {t("common.cancel")}
            </M3Button>
            <M3Button
              type="submit"
              form="station-extend-registration-form"
              loading={busy}
            >
              {t("station.detail.extendAction")}
            </M3Button>
          </>
        }
      >
        <p>{t("station.detail.extendDescription")}</p>
        {error && <p role="alert">{t(error)}</p>}
        <form
          id="station-extend-registration-form"
          onSubmit={(event) => void extendRegistration(event)}
        >
          <NumberField
            label={t("station.detail.additionalHours")}
            value={additionalHours}
            min={1}
            max={maxAdditionalHours}
            required
            onChange={(event) => setAdditionalHours(event.currentTarget.value)}
          />
        </form>
      </M3ModalDialog>
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void cancelStation()}
        title={t("station.detail.cancelTitle")}
        description={t("station.detail.cancelDescription")}
        cancelLabel={t("common.close")}
        confirmLabel={t("station.detail.cancelConfirm")}
      />
      <TypedConfirmDialog
        open={typedCancelOpen}
        onClose={() => setTypedCancelOpen(false)}
        onConfirm={() => void cancelStation()}
        title={t("station.detail.cancelTitle")}
        description={t("station.detail.cancelAfterVotingDescription")}
        word="CANCEL"
        inputLabel={t("station.detail.cancelWordLabel")}
        cancelLabel={t("common.close")}
        confirmLabel={t("station.detail.cancelConfirm")}
      />
    </main>
  );
}

export function StationDetailRoute({
  stationId,
  activeTab,
}: Readonly<{ stationId: string; activeTab: StationDetailTab }>) {
  return (
    <SessionGate>
      <HostShell>
        <StationDetail stationId={stationId} activeTab={activeTab} />
      </HostShell>
    </SessionGate>
  );
}

export function isStationDetailTab(value: string): value is StationDetailTab {
  return tabDefinitions.some((tab) => tab.id === value);
}
