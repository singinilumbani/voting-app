"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  CopyLinkField,
  DateTimeField,
  M3Banner,
  M3Button,
  M3Card,
  M3TextField,
  NumberField,
  Toggle,
} from "@/components/ui/primitives";
import { ConfirmDialog, M3ModalDialog } from "@/components/ui/dialogs";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";
import {
  discardStationDraft,
  readStationDraft,
  saveStationDraft,
  type StationWizardDraft,
} from "@/lib/host/station-draft";
import { useCurrentTime } from "@/lib/host/use-current-time";
import {
  parseVotingConfiguration,
  registrationFormSchema,
  stationBasicsSchema,
} from "@/lib/host/station-validation";
import { stationsApi } from "@/lib/api/stations";
import type { StationDto } from "@/lib/api/schemas";
import { STATION_LIMITS } from "@/lib/shared/station-constants";
import { ImageUploader } from "./ImageUploader";

type CategoryDto = NonNullable<StationDto["categories"]>[number];
type CandidateDto = NonNullable<CategoryDto["candidates"]>[number];

type StationWizardProps = Readonly<{
  initialStationId?: string;
  resumeSavedDraft?: boolean;
}>;

function freshDraft(): StationWizardDraft {
  return {
    step: 0,
    basics: {
      name: "",
      description: "",
      mode: "PUBLIC_POLL",
      resultsVisibility: "CONCEALED",
      allowAbstain: false,
      mobileOnly: false,
    },
    registration: {
      voterCap: String(STATION_LIMITS.registration.defaultVoters),
      durationHours: String(STATION_LIMITS.registration.defaultDurationHours),
    },
    voting: {
      startMode: "NOW",
      startsAt: "",
      durationMinutes: String(STATION_LIMITS.voting.defaultDurationMinutes),
    },
    pendingCategoryTitle: "",
    pendingCandidate: null,
  };
}

function stationIdOf(station: StationDto | null): string | undefined {
  return station?.id ?? station?.stationId;
}

function categoryCandidates(category: CategoryDto): CandidateDto[] {
  return category.candidates ?? [];
}

function needsMoreCandidates(category: CategoryDto): boolean {
  return (
    categoryCandidates(category).length <
    STATION_LIMITS.candidatesPerCategory.minimum
  );
}

function candidateImage(candidate: CandidateDto): string | null {
  return candidate.imageUrl ?? candidate.picture ?? null;
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function errorKey(error: unknown): string {
  return error instanceof ApiError ? error.key : "errors.internal";
}

export function StationWizard({
  initialStationId,
  resumeSavedDraft = false,
}: StationWizardProps) {
  const t = useT();
  const router = useRouter();
  const now = useCurrentTime();
  const [draft, setDraft] = useState<StationWizardDraft>(freshDraft);
  const [station, setStation] = useState<StationDto | null>(null);
  const [locked, setLocked] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [ready, setReady] = useState(false);
  const [persistDraft, setPersistDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = useState<StationWizardDraft | null>(
    null,
  );
  const [resumeOpen, setResumeOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [categoryDelete, setCategoryDelete] = useState<CategoryDto | null>(
    null,
  );
  const [candidateDelete, setCandidateDelete] = useState<CandidateDto | null>(
    null,
  );
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [candidateImageUrl, setCandidateImageUrl] = useState<string | null>(
    null,
  );
  const [candidateUploading, setCandidateUploading] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    shareLink: string;
    warningKey?: string;
  } | null>(null);

  const activeStationId = stationIdOf(station) ?? initialStationId;
  const steps = useMemo(
    () => [
      { index: 0, label: t("station.steps.basics") },
      { index: 1, label: t("station.steps.positions") },
      { index: 2, label: t("station.steps.nominees") },
      ...(draft.basics.mode === "CLOSED_VOTE"
        ? [{ index: 3, label: t("station.steps.registration") }]
        : []),
      { index: 4, label: t("station.steps.voting") },
    ],
    [draft.basics.mode, t],
  );

  function applyStation(stationDto: StationDto, idFallback?: string) {
    const id = stationIdOf(stationDto) ?? idFallback;
    setStation(stationDto);
    setLocked(stationDto.status.toUpperCase() !== "DRAFT");
    setCategories(stationDto.categories ?? []);
    setDraft((current) => ({
      ...current,
      stationId: id,
      basics: {
        name: stationDto.name,
        description: stationDto.description ?? "",
        mode: stationDto.mode,
        resultsVisibility:
          stationDto.resultsVisibility ?? current.basics.resultsVisibility,
        allowAbstain: stationDto.allowAbstain ?? false,
        mobileOnly: stationDto.mobileOnly ?? stationDto.mode === "CLOSED_VOTE",
      },
      registration: {
        voterCap: String(
          stationDto.voterCap ?? STATION_LIMITS.registration.defaultVoters,
        ),
        durationHours: String(
          stationDto.registrationDurationHours ??
            STATION_LIMITS.registration.defaultDurationHours,
        ),
      },
      voting: {
        startMode: stationDto.scheduled ? "SCHEDULED" : "NOW",
        startsAt: stationDto.voteStartsAt
          ? localDateTimeValue(new Date(stationDto.voteStartsAt))
          : "",
        durationMinutes: String(
          stationDto.votingDurationMinutes ??
            STATION_LIMITS.voting.defaultDurationMinutes,
        ),
      },
    }));
    setPersistDraft(true);
  }

  async function restoreDraft(saved: StationWizardDraft) {
    setError(null);
    setBusy(true);
    try {
      if (saved.stationId) {
        const response = await stationsApi.get(saved.stationId);
        setStation(response.station);
        setLocked(response.station.status.toUpperCase() !== "DRAFT");
        setCategories(response.station.categories ?? []);
      }
      setDraft(saved);
      setPersistDraft(true);
      setCandidateImageUrl(saved.pendingCandidate?.imageUrl ?? null);
      setCandidateModalOpen(saved.pendingCandidate !== null);
      setResumePrompt(null);
      setResumeOpen(false);
      setReady(true);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      let saved: StationWizardDraft | null = null;
      try {
        saved = readStationDraft();
      } catch {
        if (active) setError("station.draft.invalid");
      }

      try {
        if (initialStationId) {
          const response = await stationsApi.get(initialStationId);
          if (!active) return;
          applyStation(response.station, initialStationId);
          setPersistDraft(true);
          if (
            saved?.stationId === initialStationId &&
            (resumeSavedDraft || saved.step > 0 || saved.pendingCandidate)
          ) {
            if (resumeSavedDraft) {
              setDraft(saved);
              setCandidateImageUrl(saved.pendingCandidate?.imageUrl ?? null);
              setCandidateModalOpen(saved.pendingCandidate !== null);
              setPersistDraft(true);
            } else {
              setResumePrompt(saved);
              setResumeOpen(true);
            }
          }
        } else if (saved) {
          if (resumeSavedDraft) {
            await restoreDraft(saved);
          } else {
            setResumePrompt(saved);
            setResumeOpen(true);
          }
        }
      } catch (failure) {
        if (active) setError(errorKey(failure));
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [initialStationId, resumeSavedDraft]);

  useEffect(() => {
    if (!ready || !persistDraft || resumePrompt !== null) return;
    const timeout = window.setTimeout(() => {
      try {
        saveStationDraft(draft);
      } catch {
        setError("station.draft.storageUnavailable");
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [draft, persistDraft, ready, resumePrompt]);

  useEffect(() => {
    if (!dirty) return;
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  function updateBasics(patch: Partial<StationWizardDraft["basics"]>) {
    setDraft((current) => ({
      ...current,
      basics: { ...current.basics, ...patch },
    }));
    setPersistDraft(true);
    setDirty(true);
  }

  function updateRegistration(
    patch: Partial<StationWizardDraft["registration"]>,
  ) {
    setDraft((current) => ({
      ...current,
      registration: { ...current.registration, ...patch },
    }));
    setPersistDraft(true);
    setDirty(true);
  }

  function updateVoting(patch: Partial<StationWizardDraft["voting"]>) {
    setDraft((current) => ({
      ...current,
      voting: { ...current.voting, ...patch },
    }));
    setPersistDraft(true);
    setDirty(true);
  }

  function moveToStep(next: number) {
    setDraft((current) => ({ ...current, step: next }));
    setPersistDraft(true);
    setDirty(false);
    setError(null);
  }

  async function saveBasicsAndContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = stationBasicsSchema.safeParse(draft.basics);
    if (!parsed.success) {
      setError("station.validation.name");
      return;
    }
    setBusy(true);
    try {
      const input = {
        ...parsed.data,
        description: parsed.data.description || null,
      };
      const response = station
        ? await stationsApi.update(activeStationId ?? "", input)
        : await stationsApi.create(input);
      const id = stationIdOf(response.station) ?? activeStationId;
      if (!id) {
        setError("errors.internal");
        return;
      }
      setStation(response.station);
      setLocked(false);
      setCategories(response.station.categories ?? categories);
      setDraft((current) => ({ ...current, stationId: id, step: 1 }));
      setPersistDraft(true);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!activeStationId || !draft.pendingCategoryTitle.trim()) {
      setError("station.validation.categoryName");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await stationsApi.createCategory(
        activeStationId,
        draft.pendingCategoryTitle.trim(),
      );
      setCategories((current) => [...current, response.category]);
      setDraft((current) => ({ ...current, pendingCategoryTitle: "" }));
      setPersistDraft(true);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(categoryId: string, title: string) {
    if (!activeStationId || !title.trim()) {
      setError("station.validation.categoryName");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await stationsApi.updateCategory(
        activeStationId,
        categoryId,
        title.trim(),
      );
      setCategories((current) =>
        current.map((category) =>
          category.id === categoryId ? response.category : category,
        ),
      );
      setDraft((current) => ({
        ...current,
        pendingCategoryTitle: "",
        pendingCategoryId: undefined,
      }));
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function reorderCategory(category: CategoryDto, direction: -1 | 1) {
    if (!activeStationId) return;
    const index = categories.findIndex((item) => item.id === category.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) return;
    const reordered = [...categories];
    const [moving] = reordered.splice(index, 1);
    if (!moving) return;
    reordered.splice(nextIndex, 0, moving);
    setBusy(true);
    try {
      const response = await stationsApi.orderCategories(
        activeStationId,
        reordered.map((item) => item.id),
      );
      setCategories(response.categories);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory() {
    if (!activeStationId || !categoryDelete) return;
    setBusy(true);
    setError(null);
    try {
      await stationsApi.deleteCategory(activeStationId, categoryDelete.id);
      setCategories((current) =>
        current.filter((category) => category.id !== categoryDelete.id),
      );
      setCategoryDelete(null);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
      setCategoryDelete(null);
    } finally {
      setBusy(false);
    }
  }

  function openCandidateDialog(
    category: CategoryDto,
    candidate?: CandidateDto,
  ) {
    const imageUrl = candidate ? candidateImage(candidate) : null;
    setCandidateImageUrl(imageUrl);
    setDraft((current) => ({
      ...current,
      pendingCandidate: {
        categoryId: category.id,
        ...(candidate ? { candidateId: candidate.id } : {}),
        name: candidate?.name ?? "",
        ...(imageUrl ? { imageUrl } : {}),
      },
    }));
    setPersistDraft(true);
    setCandidateModalOpen(true);
  }

  function closeCandidateDialog() {
    setCandidateModalOpen(false);
    setDraft((current) => ({ ...current, pendingCandidate: null }));
    setCandidateImageUrl(null);
  }

  async function saveCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pending = draft.pendingCandidate;
    if (!activeStationId || !pending || !pending.name.trim()) {
      setError("station.validation.candidateName");
      return;
    }
    if (candidateUploading) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: pending.name.trim(),
        ...(candidateImageUrl ? { picture: candidateImageUrl } : {}),
      };
      let savedCandidate: CandidateDto;
      if (pending.candidateId) {
        const response = await stationsApi.updateCandidate(
          activeStationId,
          pending.candidateId,
          input,
        );
        savedCandidate = response.candidate;
      } else {
        const response = await stationsApi.createCandidate(
          activeStationId,
          pending.categoryId,
          input,
        );
        savedCandidate = response.candidate;
      }
      setCategories((current) =>
        current.map((category) => {
          if (category.id !== pending.categoryId) return category;
          const candidates = categoryCandidates(category);
          const updated = pending.candidateId
            ? candidates.map((candidate) =>
                candidate.id === pending.candidateId
                  ? savedCandidate
                  : candidate,
              )
            : [...candidates, savedCandidate];
          return { ...category, candidates: updated };
        }),
      );
      closeCandidateDialog();
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCandidate() {
    if (!activeStationId || !candidateDelete) return;
    setBusy(true);
    setError(null);
    try {
      await stationsApi.deleteCandidate(activeStationId, candidateDelete.id);
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          candidates: categoryCandidates(category).filter(
            (candidate) => candidate.id !== candidateDelete.id,
          ),
        })),
      );
      setCandidateDelete(null);
      setDirty(false);
    } catch (failure) {
      setError(errorKey(failure));
      setCandidateDelete(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveRegistrationAndContinue() {
    if (!activeStationId) return;
    const parsed = registrationFormSchema.safeParse(draft.registration);
    if (!parsed.success) {
      setError("station.validation.registration");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await stationsApi.configureRegistration(activeStationId, parsed.data);
      moveToStep(4);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }

  async function launchStation() {
    if (!activeStationId) return;
    setBusy(true);
    setError(null);
    try {
      const voting = parseVotingConfiguration(draft);
      await stationsApi.configureVoting(activeStationId, voting);
      const response = await stationsApi.launch(activeStationId);
      setLaunchResult({
        shareLink: response.shareLink,
        ...(response.warningKey ? { warningKey: response.warningKey } : {}),
      });
      setStation(response.station);
      setLocked(true);
      setPersistDraft(false);
      try {
        discardStationDraft();
      } catch {
        setError("station.draft.storageUnavailable");
      }
      setLaunchOpen(false);
      setDirty(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.key
          : failure instanceof z.ZodError
            ? failure.issues[0]?.message === "station.validation.scheduledStart"
              ? "station.validation.scheduledStart"
              : "station.validation.votingDuration"
            : "errors.internal",
      );
    } finally {
      setBusy(false);
    }
  }

  function discardSavedDraft() {
    try {
      discardStationDraft();
      setResumePrompt(null);
      setResumeOpen(false);
      if (initialStationId && station) {
        applyStation(station, initialStationId);
      } else {
        setDraft(freshDraft());
        setPersistDraft(false);
        setCategories([]);
        setStation(null);
      }
      setDirty(false);
    } catch {
      setError("station.draft.storageUnavailable");
      setResumeOpen(false);
    }
  }

  function goBack() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    if (draft.step === 0) router.push("/host");
    else if (draft.step === 4) {
      moveToStep(draft.basics.mode === "CLOSED_VOTE" ? 3 : 2);
    } else {
      moveToStep(draft.step - 1);
    }
  }

  function goToDashboard() {
    setUnsavedOpen(false);
    router.push("/host");
  }

  async function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (draft.step === 0) {
      await saveBasicsAndContinue(event);
      return;
    }
    if (draft.step === 1) {
      if (categories.length < STATION_LIMITS.categories.minimum) {
        setError("station.validation.minimumCategories");
        return;
      }
      moveToStep(2);
      return;
    }
    if (draft.step === 2) {
      if (
        categories.some(
          (category) => needsMoreCandidates(category),
        )
      ) {
        setError("station.validation.minimumCandidates");
        return;
      }
      moveToStep(draft.basics.mode === "CLOSED_VOTE" ? 3 : 4);
      return;
    }
    if (draft.step === 3) {
      await saveRegistrationAndContinue();
    }
  }

  const currentRegistrationDuration =
    Number(draft.registration.durationHours) || 0;
  const scheduleEarliest =
    now === null
      ? null
      : new Date(
          now +
      (draft.basics.mode === "CLOSED_VOTE"
        ? currentRegistrationDuration * 60 * 60 * 1000
        : 0),
        );
  const scheduleLatest = scheduleEarliest
    ? new Date(
        scheduleEarliest.getTime() +
          STATION_LIMITS.voting.maximumScheduledDays * 86_400_000,
      )
    : null;
  const scheduleMin = scheduleEarliest
    ? localDateTimeValue(scheduleEarliest)
    : undefined;
  const scheduleMax = scheduleLatest
    ? localDateTimeValue(scheduleLatest)
    : undefined;
  const selectedModeDescription =
    draft.basics.mode === "PUBLIC_POLL"
      ? t("station.mode.publicDescription")
      : t("station.mode.closedDescription");
  const showLargeVoterNotice =
    Number(draft.registration.voterCap) >
    STATION_LIMITS.registration.recommendedVoters;

  if (!ready) {
    return <p role="status">{t("station.loading")}</p>;
  }

  if (locked && !launchResult) {
    return (
      <main className="host-page station-wizard">
        <M3Banner variant="error">{t("errors.station.locked")}</M3Banner>
        <M3Button onClick={() => router.push("/host")}>
          {t("station.returnToDashboard")}
        </M3Button>
      </main>
    );
  }

  return (
    <main className="host-page station-wizard">
      {launchResult ? (
        <section className="station-launch-success">
          <h1>{t("station.launchSuccessTitle")}</h1>
          <p>{t("station.launchSuccessDescription")}</p>
          {error && <M3Banner variant="error">{t(error)}</M3Banner>}
          {launchResult.warningKey && (
            <M3Banner variant="warning">{t(launchResult.warningKey)}</M3Banner>
          )}
          <CopyLinkField
            label={t("station.shareLink")}
            value={launchResult.shareLink}
            copyLabel={t("station.copyLink")}
            copiedLabel={t("station.copiedLink")}
            copyErrorLabel={t("station.copyError")}
          />
          <div className="station-qr">
            <QRCodeSVG
              value={launchResult.shareLink}
              size={200}
              fgColor="currentColor"
              bgColor="transparent"
            />
          </div>
          <M3Button onClick={() => router.push("/host")}>
            {t("station.returnToDashboard")}
          </M3Button>
        </section>
      ) : (
        <>
          <div className="station-wizard__header">
            <M3Button
              variant="text"
              onClick={() => {
                if (draft.step === 0) {
                  if (dirty) setUnsavedOpen(true);
                  else router.push("/host");
                } else {
                  goBack();
                }
              }}
            >
              {draft.step === 0 ? t("station.dashboard") : t("common.back")}
            </M3Button>
            <span className="station-draft-indicator" role="status">
              {t("station.savedAsDraft")}
            </span>
          </div>
          <nav
            className="station-step-indicator"
            aria-label={t("station.progress")}
          >
            {steps.map((item, index) => (
              <span
                key={item.index}
                aria-current={item.index === draft.step ? "step" : undefined}
                className={
                  item.index === draft.step
                    ? "station-step station-step--current"
                    : item.index < draft.step
                      ? "station-step station-step--complete"
                      : "station-step"
                }
              >
                <span>{index + 1}</span>
                {item.label}
              </span>
            ))}
          </nav>
          <h1>
            {steps.find((item) => item.index === draft.step)?.label ??
              t("station.steps.basics")}
          </h1>
          {error &&
            ![
              "station.validation.name",
              "station.validation.categoryName",
            ].includes(error) && (
              <M3Banner variant="error">{t(error)}</M3Banner>
            )}
          {draft.step === 0 && (
            <form
              className="station-wizard__form"
              onSubmit={(event) => void handleNext(event)}
              noValidate
            >
              <M3TextField
                label={t("station.name")}
                value={draft.basics.name}
                onChange={(event) =>
                  updateBasics({ name: event.currentTarget.value })
                }
                required
                error={
                  error === "station.validation.name" ? t(error) : undefined
                }
              />
              <label className="station-field">
                <span>{t("station.description")}</span>
                <textarea
                  value={draft.basics.description}
                  onChange={(event) =>
                    updateBasics({ description: event.currentTarget.value })
                  }
                  rows={4}
                />
              </label>
              <fieldset className="station-option-group">
                <legend>{t("station.mode.title")}</legend>
                <label className="station-option-card">
                  <input
                    type="radio"
                    name="station-mode"
                    checked={draft.basics.mode === "PUBLIC_POLL"}
                    onChange={() =>
                      updateBasics({ mode: "PUBLIC_POLL", mobileOnly: false })
                    }
                  />
                  <span>{t("station.mode.public")}</span>
                  <small>{t("station.mode.publicDescription")}</small>
                </label>
                <label className="station-option-card">
                  <input
                    type="radio"
                    name="station-mode"
                    checked={draft.basics.mode === "CLOSED_VOTE"}
                    onChange={() =>
                      updateBasics({ mode: "CLOSED_VOTE", mobileOnly: true })
                    }
                  />
                  <span>{t("station.mode.closed")}</span>
                  <small>{t("station.mode.closedDescription")}</small>
                </label>
              </fieldset>
              <p className="station-field__helper">{selectedModeDescription}</p>
              <fieldset className="station-option-group">
                <legend>{t("station.resultsVisibility")}</legend>
                <label>
                  <input
                    type="radio"
                    name="results-visibility"
                    checked={draft.basics.resultsVisibility === "IMMEDIATE"}
                    onChange={() =>
                      updateBasics({ resultsVisibility: "IMMEDIATE" })
                    }
                  />
                  {t("station.results.immediate")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="results-visibility"
                    checked={draft.basics.resultsVisibility === "CONCEALED"}
                    onChange={() =>
                      updateBasics({ resultsVisibility: "CONCEALED" })
                    }
                  />
                  {t("station.results.concealed")}
                </label>
              </fieldset>
              <Toggle
                label={t("station.allowAbstain")}
                checked={draft.basics.allowAbstain}
                onCheckedChange={(allowAbstain) =>
                  updateBasics({ allowAbstain })
                }
              />
              <Toggle
                label={t("station.mobileOnly")}
                checked={draft.basics.mobileOnly}
                onCheckedChange={(mobileOnly) => updateBasics({ mobileOnly })}
              />
              <WizardNavigation
                backLabel={t("station.dashboard")}
                nextLabel={t("common.next")}
                busy={busy}
                onBack={() =>
                  dirty ? setUnsavedOpen(true) : router.push("/host")
                }
              />
            </form>
          )}
          {draft.step === 1 && (
            <section className="station-wizard__form">
              <div className="station-inline-form">
                <M3TextField
                  label={t("station.categoryName")}
                  value={draft.pendingCategoryTitle}
                  onChange={(event) => {
                    const title = event.currentTarget.value;
                    setDraft((current) => ({
                      ...current,
                      pendingCategoryTitle: title,
                    }));
                    setPersistDraft(true);
                    setDirty(true);
                  }}
                  error={
                    error === "station.validation.categoryName"
                      ? t(error)
                      : undefined
                  }
                />
                <M3Button
                  type="button"
                  leadingIcon={<Icon name="add" />}
                  loading={busy && !draft.pendingCategoryId}
                  disabled={Boolean(draft.pendingCategoryId)}
                  onClick={() => void addCategory()}
                >
                  {t("station.addCategory")}
                </M3Button>
              </div>
              <div className="station-category-list">
                {categories.map((category, index) => {
                  const editing = draft.pendingCategoryId === category.id;
                  return (
                    <M3Card key={category.id} className="station-category-row">
                      {editing ? (
                        <M3TextField
                          label={t("station.categoryName")}
                          value={draft.pendingCategoryTitle}
                          onChange={(event) => {
                            const title = event.currentTarget.value;
                            setDraft((current) => ({
                              ...current,
                              pendingCategoryTitle: title,
                            }));
                            setPersistDraft(true);
                            setDirty(true);
                          }}
                        />
                      ) : (
                        <h2>{category.title}</h2>
                      )}
                      <div className="station-category-row__actions">
                        {editing ? (
                          <M3Button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void renameCategory(
                                category.id,
                                draft.pendingCategoryTitle,
                              )
                            }
                          >
                            {t("common.save")}
                          </M3Button>
                        ) : (
                          <M3Button
                            type="button"
                            variant="text"
                            onClick={() => {
                              setDraft((current) => ({
                                ...current,
                                pendingCategoryId: category.id,
                                pendingCategoryTitle: category.title,
                              }));
                              setPersistDraft(true);
                            }}
                          >
                            {t("common.edit")}
                          </M3Button>
                        )}
                        <M3Button
                          type="button"
                          variant="outlined"
                          aria-label={t("station.moveCategoryUp", {
                            name: category.title,
                          })}
                          disabled={busy || index === 0}
                          onClick={() => void reorderCategory(category, -1)}
                        >
                          <Icon name="arrow_upward" />
                        </M3Button>
                        <M3Button
                          type="button"
                          variant="outlined"
                          aria-label={t("station.moveCategoryDown", {
                            name: category.title,
                          })}
                          disabled={busy || index === categories.length - 1}
                          onClick={() => void reorderCategory(category, 1)}
                        >
                          <Icon name="arrow_downward" />
                        </M3Button>
                        <M3Button
                          type="button"
                          variant="destructive"
                          onClick={() => setCategoryDelete(category)}
                        >
                          {t("common.delete")}
                        </M3Button>
                      </div>
                    </M3Card>
                  );
                })}
              </div>
              <WizardNavigation
                backLabel={t("common.back")}
                nextLabel={t("common.next")}
                busy={busy}
                onBack={goBack}
                onNext={() => {
                  if (categories.length === 0)
                    setError("station.validation.minimumCategories");
                  else moveToStep(2);
                }}
              />
            </section>
          )}
          {draft.step === 2 && (
            <section className="station-wizard__form">
              {categories.map((category) => {
                const candidates = categoryCandidates(category);
                return (
                  <M3Card
                    key={category.id}
                    className="station-nominee-category"
                  >
                    <header>
                      <h2>{category.title}</h2>
                      {candidates.length <
                        STATION_LIMITS.candidatesPerCategory.minimum && (
                        <span className="station-warning-chip">
                          {t("station.needsMoreCandidates")}
                        </span>
                      )}
                      <M3Button
                        type="button"
                        variant="tonal"
                        aria-label={t("station.addCandidateTo", {
                          name: category.title,
                        })}
                        leadingIcon={<Icon name="add" />}
                        onClick={() => openCandidateDialog(category)}
                      >
                        {t("station.addCandidate")}
                      </M3Button>
                    </header>
                    <div className="station-candidate-grid">
                      {candidates.map((candidate) => (
                        <article
                          key={candidate.id}
                          className="station-candidate-card"
                        >
                          {candidateImage(candidate) && (
                            <Image
                              src={candidateImage(candidate) ?? ""}
                              alt={t("station.candidateImage", {
                                name: candidate.name,
                              })}
                              width={128}
                              height={128}
                              unoptimized
                            />
                          )}
                          <h3>{candidate.name}</h3>
                          <M3Button
                            type="button"
                            variant="text"
                            onClick={() =>
                              openCandidateDialog(category, candidate)
                            }
                          >
                            {t("common.edit")}
                          </M3Button>
                          <M3Button
                            type="button"
                            variant="destructive"
                            onClick={() => setCandidateDelete(candidate)}
                          >
                            {t("common.delete")}
                          </M3Button>
                        </article>
                      ))}
                    </div>
                  </M3Card>
                );
              })}
              <WizardNavigation
                backLabel={t("common.back")}
                nextLabel={t("common.next")}
                busy={busy}
                onBack={goBack}
                onNext={() => {
                  if (
                    categories.some(
                      (category) => needsMoreCandidates(category),
                    )
                  ) {
                    setError("station.validation.minimumCandidates");
                  } else {
                    moveToStep(draft.basics.mode === "CLOSED_VOTE" ? 3 : 4);
                  }
                }}
              />
            </section>
          )}
          {draft.step === 3 && draft.basics.mode === "CLOSED_VOTE" && (
            <form
              className="station-wizard__form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveRegistrationAndContinue();
              }}
            >
              <NumberField
                label={t("station.voterCount")}
                value={draft.registration.voterCap}
                min={STATION_LIMITS.registration.minimumVoters}
                max={STATION_LIMITS.registration.maximumVoters}
                onChange={(event) =>
                  updateRegistration({ voterCap: event.currentTarget.value })
                }
                required
              />
              {showLargeVoterNotice && (
                <M3Banner variant="warning">
                  {t("station.largeVoterListNotice")}
                </M3Banner>
              )}
              <NumberField
                label={t("station.registrationDuration")}
                value={draft.registration.durationHours}
                min={STATION_LIMITS.registration.minimumDurationHours}
                max={STATION_LIMITS.registration.maximumDurationHours}
                onChange={(event) =>
                  updateRegistration({
                    durationHours: event.currentTarget.value,
                  })
                }
                required
              />
              <WizardNavigation
                backLabel={t("common.back")}
                nextLabel={t("common.next")}
                busy={busy}
                onBack={goBack}
              />
            </form>
          )}
          {draft.step === 4 && (
            <section className="station-wizard__form">
              <fieldset className="station-option-group">
                <legend>{t("station.votingStart")}</legend>
                <label>
                  <input
                    type="radio"
                    name="voting-start"
                    checked={draft.voting.startMode === "NOW"}
                    onChange={() =>
                      updateVoting({ startMode: "NOW", startsAt: "" })
                    }
                  />
                  {t("station.openNow")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="voting-start"
                    checked={draft.voting.startMode === "SCHEDULED"}
                    onChange={() => {
                      const earliest = new Date(
                        Date.now() +
                          (draft.basics.mode === "CLOSED_VOTE"
                            ? currentRegistrationDuration * 60 * 60 * 1000
                            : 0),
                      );
                      updateVoting({
                        startMode: "SCHEDULED",
                        startsAt: localDateTimeValue(earliest),
                      });
                    }}
                  />
                  {t("station.scheduleStart")}
                </label>
              </fieldset>
              {draft.voting.startMode === "SCHEDULED" && (
                <DateTimeField
                  label={t("station.scheduledStart")}
                  value={draft.voting.startsAt}
                  min={scheduleMin}
                  max={scheduleMax}
                  onChange={(event) =>
                    updateVoting({ startsAt: event.currentTarget.value })
                  }
                  required
                />
              )}
              <NumberField
                label={t("station.votingDuration")}
                value={draft.voting.durationMinutes}
                min={STATION_LIMITS.voting.minimumDurationMinutes}
                max={STATION_LIMITS.voting.maximumDurationMinutes}
                onChange={(event) =>
                  updateVoting({ durationMinutes: event.currentTarget.value })
                }
                required
              />
              <M3Card className="station-review-card">
                <h2>{t("station.reviewTitle")}</h2>
                <dl>
                  <dt>{t("station.name")}</dt>
                  <dd>{draft.basics.name}</dd>
                  <dt>{t("station.mode.title")}</dt>
                  <dd>
                    {t(
                      `station.mode.${draft.basics.mode === "PUBLIC_POLL" ? "public" : "closed"}`,
                    )}
                  </dd>
                  {draft.basics.mode === "CLOSED_VOTE" && (
                    <>
                      <dt>{t("station.voterCount")}</dt>
                      <dd>{draft.registration.voterCap}</dd>
                      <dt>{t("station.registrationDuration")}</dt>
                      <dd>
                        {t("station.hoursValue", {
                          count: Number(draft.registration.durationHours),
                        })}
                      </dd>
                    </>
                  )}
                  <dt>{t("station.positionCount")}</dt>
                  <dd>{categories.length}</dd>
                  <dt>{t("station.votingDuration")}</dt>
                  <dd>
                    {t("station.minutesValue", {
                      count: Number(draft.voting.durationMinutes),
                    })}
                  </dd>
                </dl>
              </M3Card>
              <WizardNavigation
                backLabel={t("common.back")}
                nextLabel={t("station.reviewAndLaunch")}
                busy={busy}
                onBack={goBack}
                onNext={() => {
                  try {
                    parseVotingConfiguration(draft);
                    setLaunchOpen(true);
                  } catch (failure) {
                    setError(
                      failure instanceof z.ZodError
                        ? failure.issues[0]?.message ===
                          "station.validation.scheduledStart"
                          ? "station.validation.scheduledStart"
                          : "station.validation.votingDuration"
                        : "station.validation.scheduledStart",
                    );
                  }
                }}
              />
            </section>
          )}
        </>
      )}
      <ConfirmDialog
        open={resumeOpen && resumePrompt !== null}
        onClose={() => {
          if (resumePrompt) void restoreDraft(resumePrompt);
        }}
        onConfirm={discardSavedDraft}
        title={t("station.resumeTitle")}
        description={t("station.resumeDescription")}
        cancelLabel={t("station.resumeDraft")}
        confirmLabel={t("station.discardDraft")}
      />
      <ConfirmDialog
        open={unsavedOpen}
        onClose={() => setUnsavedOpen(false)}
        onConfirm={goToDashboard}
        title={t("station.unsavedTitle")}
        description={t("station.unsavedDescription")}
        cancelLabel={t("station.stay")}
        confirmLabel={t("station.leave")}
      />
      <ConfirmDialog
        open={categoryDelete !== null}
        onClose={() => setCategoryDelete(null)}
        onConfirm={() => void deleteCategory()}
        title={t("station.deleteCategoryTitle")}
        description={t("station.deleteCategoryDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
      />
      <ConfirmDialog
        open={candidateDelete !== null}
        onClose={() => setCandidateDelete(null)}
        onConfirm={() => void deleteCandidate()}
        title={t("station.removeCandidateTitle")}
        description={t("station.removeCandidateDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
      />
      <ConfirmDialog
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        onConfirm={() => void launchStation()}
        title={t("station.launchConfirmTitle")}
        description={t("station.launchConfirmDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("station.launch")}
      />
      <M3ModalDialog
        open={candidateModalOpen && draft.pendingCandidate !== null}
        onClose={closeCandidateDialog}
        title={t(
          draft.pendingCandidate?.candidateId
            ? "station.editCandidate"
            : "station.addCandidate",
        )}
        actions={null}
      >
        {draft.pendingCandidate && (
          <form
            className="station-candidate-form"
            onSubmit={(event) => void saveCandidate(event)}
          >
            <M3TextField
              label={t("station.candidateName")}
              value={draft.pendingCandidate.name}
              onChange={(event) => {
                const name = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  pendingCandidate: current.pendingCandidate
                    ? { ...current.pendingCandidate, name }
                    : null,
                }));
                setPersistDraft(true);
                setDirty(true);
              }}
              required
            />
            <ImageUploader
              stationId={activeStationId ?? ""}
              imageUrl={candidateImageUrl}
              draftImageDataUrl={draft.pendingCandidate.imageDataUrl}
              onImageUrlChange={(imageUrl) => {
                setCandidateImageUrl(imageUrl);
                setDraft((current) => ({
                  ...current,
                  pendingCandidate: current.pendingCandidate
                    ? {
                        ...current.pendingCandidate,
                        imageUrl: imageUrl ?? undefined,
                      }
                    : null,
                }));
                setPersistDraft(true);
              }}
              onDraftImageChange={(imageDataUrl) => {
                setDraft((current) => ({
                  ...current,
                  pendingCandidate: current.pendingCandidate
                    ? { ...current.pendingCandidate, imageDataUrl }
                    : null,
                }));
                setPersistDraft(true);
              }}
              onUploadStateChange={setCandidateUploading}
              fileLabel={t("station.imageFile")}
              previewLabel={t("station.imagePreview")}
              removeLabel={t("station.removeImage")}
              failureTitle={t("station.uploadFailureTitle")}
              failureDescription={t("station.uploadFailureDescription")}
              fileTooLarge={t("station.image.too_large")}
              retryLabel={t("station.retryUpload")}
              closeLabel={t("common.close")}
              uploadingLabel={t("station.uploading")}
              translateError={t}
            />
            <div className="ui-dialog__actions">
              <M3Button
                type="button"
                variant="text"
                onClick={closeCandidateDialog}
              >
                {t("common.cancel")}
              </M3Button>
              <M3Button
                type="submit"
                loading={busy}
                disabled={
                  candidateUploading ||
                  (Boolean(draft.pendingCandidate.imageDataUrl) &&
                    !candidateImageUrl)
                }
              >
                {t("common.save")}
              </M3Button>
            </div>
          </form>
        )}
      </M3ModalDialog>
    </main>
  );
}

function WizardNavigation({
  backLabel,
  nextLabel,
  busy = false,
  onBack,
  onNext,
}: Readonly<{
  backLabel: string;
  nextLabel: string;
  busy?: boolean;
  onBack?: () => void;
  onNext?: () => void;
}>) {
  return (
    <div className="station-wizard__navigation">
      <M3Button
        type="button"
        variant="outlined"
        disabled={busy || !onBack}
        onClick={onBack}
      >
        {backLabel}
      </M3Button>
      {onNext ? (
        <M3Button type="button" loading={busy} onClick={onNext}>
          {nextLabel}
        </M3Button>
      ) : (
        <M3Button type="submit" loading={busy}>
          {nextLabel}
        </M3Button>
      )}
    </div>
  );
}
