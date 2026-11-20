"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import type { VoterDto } from "@/lib/api/schemas";
import { votersApi } from "@/lib/api/voters";
import { ConfirmDialog, M3ModalDialog } from "@/components/ui/dialogs";
import {
  EmptyState,
  M3Banner,
  M3Button,
  M3Card,
  M3Select,
  M3TextField,
  SkeletonLoader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

const pageSize = 25;
const voterStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "VOTED",
  "REVOKED",
] as const;

const voterStatusSchema = z.enum(voterStatuses);
type VoterStatus = (typeof voterStatuses)[number];
type AsyncAction<T> = { (): Promise<T> };
type ActionResult<T> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>;
type RejectTarget =
  | Readonly<{ kind: "single"; voterId: string }>
  | Readonly<{ kind: "bulk"; voterIds: readonly string[] }>;

const statusLabels: Record<VoterStatus, string> = {
  PENDING: "station.approval.status.pending",
  APPROVED: "station.approval.status.approved",
  REJECTED: "station.approval.status.rejected",
  VOTED: "station.approval.status.voted",
  REVOKED: "station.approval.status.revoked",
};

function errorKey(error: unknown): string {
  return error instanceof ApiError ? error.key : "errors.internal";
}

function statusTone(
  status: VoterStatus,
): "neutral" | "success" | "warning" | "error" {
  if (status === "PENDING") return "warning";
  if (status === "APPROVED" || status === "VOTED") return "success";
  if (status === "REJECTED") return "error";
  return "neutral";
}

function voterIdOf(voter: VoterDto): string {
  return voter.id ?? voter.voterId ?? "";
}

function registeredAtLabel(value: string | undefined, unavailable: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return unavailable;
  return new Intl.DateTimeFormat("en-MW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isApprovalOpen(status: string): boolean {
  return [
    "REG_OPEN",
    "REGISTRATION_OPEN",
    "REG_CLOSED",
    "REGISTRATION_CLOSED",
  ].includes(status.toUpperCase());
}

function isVoterActionOpen(status: string): boolean {
  return [
    "REG_OPEN",
    "REGISTRATION_OPEN",
    "REG_CLOSED",
    "REGISTRATION_CLOSED",
    "VOTE_OPEN",
    "VOTING_OPEN",
  ].includes(status.toUpperCase());
}

type VoterRowProps = Readonly<{
  voter: VoterDto;
  selected: boolean;
  selectionDisabled: boolean;
  actionsDisabled: boolean;
  voterActionsDisabled: boolean;
  actionBusy: boolean;
  onSelect: (voterId: string, selected: boolean) => void;
  onApprove: (voterId: string) => void;
  onReject: (voterId: string) => void;
  onRevoke: (voterId: string) => void;
  onReissue: (voterId: string) => void;
  onBlock: (voterId: string) => void;
}>;

export function VoterRow({
  voter,
  selected,
  selectionDisabled,
  actionsDisabled,
  voterActionsDisabled,
  actionBusy,
  onSelect,
  onApprove,
  onReject,
  onRevoke,
  onReissue,
  onBlock,
}: VoterRowProps) {
  const t = useT();
  const status = voter.status;
  const voterId = voterIdOf(voter);
  const voted = status === "VOTED" || voter.hasVoted === true;
  const canApproveOrReject = status === "PENDING" && Boolean(voterId);
  const canRevokeForVoter = status === "APPROVED" && !voted && Boolean(voterId);
  const canReissueForVoter =
    (status === "PENDING" || status === "APPROVED") &&
    !voted &&
    Boolean(voterId);
  const canRevoke = canRevokeForVoter && !voterActionsDisabled;
  const canReissue = canReissueForVoter && !voterActionsDisabled;
  const deviceCount = /^SAME_DEVICE_AS_(\d+)$/.exec(voter.deviceFlag ?? "");
  const flagLabel = deviceCount
    ? t("station.approval.sameDevice", { count: Number(deviceCount[1]) })
    : voter.flagReason
      ? t(voter.flagReason)
      : undefined;

  return (
    <article
      className="approval-queue__voter ui-card"
      aria-label={voter.fullName}
    >
      <div className="approval-queue__voter-main">
        <div className="approval-queue__voter-title">
          {status === "PENDING" && (
            <input
              type="checkbox"
              aria-label={t("station.approval.selectVoter", {
                name: voter.fullName,
              })}
              checked={selected}
              disabled={selectionDisabled || !voterId}
              onChange={(event) =>
                onSelect(voterId, event.currentTarget.checked)
              }
            />
          )}
          <div>
            <h3>{voter.fullName}</h3>
            <p>{voter.phone ?? t("station.approval.phoneUnavailable")}</p>
          </div>
          <StatusBadge status={statusTone(status)}>
            {t(statusLabels[status])}
          </StatusBadge>
        </div>
        <dl className="approval-queue__voter-meta">
          <div>
            <dt>{t("station.approval.registeredAt")}</dt>
            <dd>
              {registeredAtLabel(
                voter.registeredAt,
                t("station.approval.timeUnavailable"),
              )}
            </dd>
          </div>
          {flagLabel && (
            <div>
              <dt>{t("station.approval.deviceFlagLabel")}</dt>
              <dd>
                <span
                  className="approval-queue__device-flag"
                  title={t("station.approval.deviceFlagHint")}
                >
                  {flagLabel}
                </span>
              </dd>
            </div>
          )}
          {voter.blocked && (
            <div>
              <dt>{t("station.approval.blockedLabel")}</dt>
              <dd>{t("station.approval.blockedValue")}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="approval-queue__row-actions">
        {voter.whatsappUrl ? (
          <a
            className="ui-button ui-button--outlined"
            href={voter.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("station.approval.whatsapp")}
          </a>
        ) : (
          <span className="approval-queue__unavailable">
            {t("station.approval.whatsappUnavailable")}
          </span>
        )}
        {canApproveOrReject && (
          <>
            <M3Button
              variant="tonal"
              disabled={actionsDisabled || actionBusy}
              title={
                actionsDisabled
                  ? t("station.approval.approvalLocked")
                  : undefined
              }
              onClick={() => onApprove(voterId)}
            >
              {t("station.approval.approve", { name: voter.fullName })}
            </M3Button>
            <M3Button
              variant="outlined"
              disabled={actionsDisabled || actionBusy}
              title={
                actionsDisabled
                  ? t("station.approval.approvalLocked")
                  : undefined
              }
              onClick={() => onReject(voterId)}
            >
              {t("station.approval.reject", { name: voter.fullName })}
            </M3Button>
          </>
        )}
        {canRevoke && (
          <M3Button
            variant="outlined"
            disabled={actionBusy}
            onClick={() => onRevoke(voterId)}
          >
            {t("station.approval.revoke", { name: voter.fullName })}
          </M3Button>
        )}
        {canReissue && (
          <M3Button
            variant="outlined"
            disabled={actionBusy}
            onClick={() => onReissue(voterId)}
          >
            {t("station.approval.reissue", { name: voter.fullName })}
          </M3Button>
        )}
        {!voter.blocked && voterId && (
          <M3Button
            variant="text"
            disabled={actionBusy}
            onClick={() => onBlock(voterId)}
          >
            {t("station.approval.block", { name: voter.fullName })}
          </M3Button>
        )}
        {voterActionsDisabled && (canRevokeForVoter || canReissueForVoter) && (
          <span className="approval-queue__lock-hint">
            {t("station.approval.voterActionsLocked")}
          </span>
        )}
      </div>
    </article>
  );
}

type BulkActionBarProps = Readonly<{
  selectedCount: number;
  disabled: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
}>;

export function BulkActionBar({
  selectedCount,
  disabled,
  busy,
  onApprove,
  onReject,
  onClear,
}: BulkActionBarProps) {
  const t = useT();
  if (selectedCount === 0) return null;
  return (
    <div className="approval-queue__bulk-bar" role="region" aria-live="polite">
      <span>
        {t("station.approval.selectedCount", { count: selectedCount })}
      </span>
      <M3Button disabled={disabled || busy} onClick={onApprove}>
        {t("station.approval.approveSelected")}
      </M3Button>
      <M3Button
        variant="outlined"
        disabled={disabled || busy}
        onClick={onReject}
      >
        {t("station.approval.rejectSelected")}
      </M3Button>
      <M3Button variant="text" disabled={busy} onClick={onClear}>
        {t("station.approval.clearSelection")}
      </M3Button>
    </div>
  );
}

export type ApprovalQueueProps = Readonly<{
  stationId: string;
  stationStatus: string;
  voterCap?: number;
}>;

export function ApprovalQueue({
  stationId,
  stationStatus,
  voterCap,
}: ApprovalQueueProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VoterStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<string | null>(null);
  const [reissuedToken, setReissuedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const approvalOpen = isApprovalOpen(stationStatus);
  const voterActionsOpen = isVoterActionOpen(stationStatus);

  const votersQuery = useQuery({
    queryKey: ["station-voters", stationId, search.trim(), statusFilter, page],
    queryFn: () =>
      votersApi.list(stationId, {
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        pageSize,
      }),
  });
  const integrityQuery = useQuery({
    queryKey: ["station-voter-integrity", stationId],
    queryFn: () => votersApi.integrity(stationId),
  });
  const voters = votersQuery.data?.voters ?? [];
  const counts = votersQuery.data?.counts;
  const cap = counts?.cap ?? voterCap ?? 0;
  const pendingCount = counts?.pending ?? 0;
  const approvedCount = (counts?.approved ?? 0) + (counts?.voted ?? 0);
  const pages = Math.max(
    1,
    Math.ceil(
      (votersQuery.data?.total ?? 0) / (votersQuery.data?.pageSize ?? pageSize),
    ),
  );
  const integrity = integrityQuery.data;
  const integrityAlert =
    integrity !== undefined &&
    (integrity.alert || integrity.ballotsCast > integrity.approvedVoters);

  async function refreshQueue(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["station-voters", stationId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["station-voter-integrity", stationId],
      }),
    ]);
  }

  async function runAction<T>(
    action: AsyncAction<T>,
  ): Promise<ActionResult<T>> {
    setActionBusy(true);
    setActionError(null);
    try {
      const value = await action();
      await refreshQueue();
      return { ok: true, value };
    } catch (error) {
      setActionError(errorKey(error));
      return { ok: false };
    } finally {
      setActionBusy(false);
    }
  }

  async function approveVoter(voterId: string): Promise<void> {
    await runAction(() => votersApi.approve(stationId, voterId));
  }

  function openReject(target: RejectTarget): void {
    setRejectReason("");
    setRejectTarget(target);
  }

  function closeReject(): void {
    setRejectTarget(null);
    setRejectReason("");
  }

  async function submitReject(): Promise<void> {
    if (!rejectTarget) return;
    const target = rejectTarget;
    if (target.kind === "single") {
      const reason = rejectReason.trim() || undefined;
      const result = await runAction(() =>
        votersApi.reject(stationId, target.voterId, reason),
      );
      if (!result.ok) return;
    } else {
      const result = await runAction(() =>
        votersApi.bulkReject(stationId, {
          voterIds: [...target.voterIds],
        }),
      );
      if (!result.ok) return;
    }
    closeReject();
    setSelectedIds([]);
  }

  async function approveSelected(): Promise<void> {
    if (selectedIds.length === 0) return;
    const result = await runAction(() =>
      votersApi.bulkApprove(stationId, { voterIds: selectedIds }),
    );
    if (result.ok) setSelectedIds([]);
  }

  async function approveAll(): Promise<void> {
    const result = await runAction(() =>
      votersApi.bulkApprove(stationId, { allPending: true }),
    );
    if (result.ok) setApproveAllOpen(false);
  }

  async function revokeVoter(): Promise<void> {
    if (!revokeTarget) return;
    const result = await runAction(() =>
      votersApi.revoke(stationId, revokeTarget),
    );
    if (result.ok) setRevokeTarget(null);
  }

  async function blockNumber(): Promise<void> {
    if (!blockTarget) return;
    const result = await runAction(() =>
      votersApi.blockNumber(stationId, blockTarget),
    );
    if (result.ok) setBlockTarget(null);
  }

  async function reissueToken(voterId: string): Promise<void> {
    const result = await runAction(() =>
      votersApi.reissueToken(stationId, voterId),
    );
    if (result.ok) {
      setTokenCopied(false);
      setReissuedToken(result.value.token);
    }
  }

  function closeReissuedToken(): void {
    setReissuedToken(null);
    setTokenCopied(false);
  }

  async function copyReissuedToken(): Promise<void> {
    if (!reissuedToken) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(reissuedToken);
      setTokenCopied(true);
    } catch {
      setActionError("station.approval.copyError");
    }
  }

  async function exportCsv(): Promise<void> {
    setActionBusy(true);
    setActionError(null);
    try {
      const csv = await votersApi.exportCsv(stationId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `station-${stationId.replace(/[^A-Za-z0-9_-]/g, "_")}-voters.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setActionError(errorKey(error));
    } finally {
      setActionBusy(false);
    }
  }

  function setVoterSelected(voterId: string, selected: boolean): void {
    setSelectedIds((current) =>
      selected
        ? current.includes(voterId)
          ? current
          : [...current, voterId]
        : current.filter((id) => id !== voterId),
    );
  }

  function changePage(nextPage: number): void {
    setSelectedIds([]);
    setPage(nextPage);
  }

  const lockMessage = !approvalOpen
    ? t("station.approval.approvalLocked")
    : undefined;
  const voterActionLockMessage = !voterActionsOpen
    ? t("station.approval.voterActionsLocked")
    : undefined;

  return (
    <section className="approval-queue" aria-labelledby="approval-queue-title">
      <header className="approval-queue__header">
        <div>
          <h2 id="approval-queue-title">{t("station.approval.title")}</h2>
          <p>{t("station.approval.description")}</p>
        </div>
        <M3Button
          variant="outlined"
          disabled={actionBusy}
          loading={actionBusy}
          onClick={() => void exportCsv()}
        >
          {t("station.approval.exportCsv")}
        </M3Button>
      </header>

      {stationStatus.toUpperCase() === "REG_CLOSED" ||
      stationStatus.toUpperCase() === "REGISTRATION_CLOSED" ? (
        <M3Banner variant="warning">
          {t("station.approval.registrationClosedBanner")}
        </M3Banner>
      ) : null}
      {lockMessage && <M3Banner variant="warning">{lockMessage}</M3Banner>}
      {voterActionLockMessage && (
        <M3Banner variant="info">{voterActionLockMessage}</M3Banner>
      )}
      {actionError && <M3Banner variant="error">{t(actionError)}</M3Banner>}
      {votersQuery.error && (
        <M3Banner variant="error">{t(errorKey(votersQuery.error))}</M3Banner>
      )}

      <div
        className="approval-queue__counts"
        role="group"
        aria-label={t("station.approval.counts")}
      >
        <M3Card>
          <span>{t("station.approval.pendingCount")}</span>
          <strong>{pendingCount}</strong>
        </M3Card>
        <M3Card>
          <span>{t("station.approval.approvedCount")}</span>
          <strong>
            {t("station.approval.approvedOfCap", {
              approved: approvedCount,
              cap,
            })}
          </strong>
        </M3Card>
        <M3Card>
          <span>{t("station.approval.estimatedVoters")}</span>
          <strong>{cap}</strong>
        </M3Card>
      </div>

      <section
        className="approval-queue__integrity"
        aria-label={t("station.approval.integrityTitle")}
      >
        <h3>{t("station.approval.integrityTitle")}</h3>
        {integrityQuery.isPending ? (
          <SkeletonLoader label={t("station.approval.loading")} count={1} />
        ) : integrityQuery.error ? (
          <M3Banner variant="error">
            {t(errorKey(integrityQuery.error))}
          </M3Banner>
        ) : integrity ? (
          <>
            <dl>
              <div>
                <dt>{t("station.approval.integrityApproved")}</dt>
                <dd>{integrity.approvedVoters}</dd>
              </div>
              <div>
                <dt>{t("station.approval.integrityBallots")}</dt>
                <dd>{integrity.ballotsCast}</dd>
              </div>
              <div>
                <dt>{t("station.approval.integrityAbstentions")}</dt>
                <dd>{integrity.abstentions}</dd>
              </div>
            </dl>
            {integrityAlert && (
              <M3Banner variant="error">
                {t("station.approval.integrityAlert", {
                  ballots: integrity.ballotsCast,
                  approved: integrity.approvedVoters,
                })}
              </M3Banner>
            )}
          </>
        ) : null}
      </section>

      <div className="approval-queue__controls">
        <M3TextField
          type="search"
          label={t("station.approval.search")}
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.currentTarget.value);
            setSelectedIds([]);
          }}
        />
        <M3Select
          label={t("station.approval.filterStatus")}
          value={statusFilter}
          placeholder={t("station.approval.allStatuses")}
          onChange={(event) => {
            setPage(1);
            const value = event.currentTarget.value;
            if (value === "") {
              setStatusFilter("");
              setSelectedIds([]);
              return;
            }
            const parsed = voterStatusSchema.safeParse(value);
            if (!parsed.success) {
              setActionError("errors.validation.failed");
              return;
            }
            setStatusFilter(parsed.data);
            setSelectedIds([]);
          }}
          options={voterStatuses.map((status) => ({
            value: status,
            label: t(statusLabels[status]),
          }))}
        />
        <M3Button
          variant="outlined"
          disabled={!approvalOpen || actionBusy || pendingCount === 0}
          title={
            !approvalOpen ? t("station.approval.approvalLocked") : undefined
          }
          onClick={() => setApproveAllOpen(true)}
        >
          {t("station.approval.approveAll", { count: pendingCount })}
        </M3Button>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        disabled={!approvalOpen}
        busy={actionBusy}
        onApprove={() => void approveSelected()}
        onReject={() =>
          openReject({ kind: "bulk", voterIds: [...selectedIds] })
        }
        onClear={() => setSelectedIds([])}
      />

      {votersQuery.isPending ? (
        <SkeletonLoader
          label={t("station.approval.loading")}
          count={4}
          className="approval-queue__skeleton"
        />
      ) : votersQuery.data && voters.length === 0 ? (
        <EmptyState
          title={t("station.approval.emptyTitle")}
          description={t("station.approval.emptyDescription")}
        />
      ) : (
        <>
          <div className="approval-queue__rows" aria-live="polite">
            {voters.map((voter) => {
              const voterId = voterIdOf(voter);
              return (
                <VoterRow
                  key={
                    voterId || `${voter.fullName}-${voter.registeredAt ?? ""}`
                  }
                  voter={voter}
                  selected={selectedIds.includes(voterId)}
                  selectionDisabled={!approvalOpen || actionBusy}
                  actionsDisabled={!approvalOpen}
                  voterActionsDisabled={!voterActionsOpen}
                  actionBusy={actionBusy}
                  onSelect={setVoterSelected}
                  onApprove={(id) => void approveVoter(id)}
                  onReject={(id) => openReject({ kind: "single", voterId: id })}
                  onRevoke={setRevokeTarget}
                  onReissue={(id) => void reissueToken(id)}
                  onBlock={setBlockTarget}
                />
              );
            })}
          </div>
          <nav
            className="approval-queue__pagination"
            aria-label={t("station.approval.pagination")}
          >
            <M3Button
              variant="outlined"
              disabled={page <= 1 || actionBusy}
              onClick={() => changePage(Math.max(1, page - 1))}
            >
              {t("station.approval.previous")}
            </M3Button>
            <span>
              {t("station.approval.pageOf", {
                page,
                pages,
                total: votersQuery.data?.total ?? 0,
              })}
            </span>
            <M3Button
              variant="outlined"
              disabled={page >= pages || actionBusy}
              onClick={() => changePage(Math.min(pages, page + 1))}
            >
              {t("station.approval.next")}
            </M3Button>
          </nav>
        </>
      )}

      <ConfirmDialog
        open={approveAllOpen}
        onClose={() => setApproveAllOpen(false)}
        onConfirm={() => void approveAll()}
        title={t("station.approval.approveAllTitle")}
        description={t("station.approval.approveAllDescription", {
          count: pendingCount,
        })}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("station.approval.approveAllConfirm")}
      />
      <M3ModalDialog
        open={rejectTarget !== null}
        onClose={closeReject}
        title={t(
          rejectTarget?.kind === "bulk"
            ? "station.approval.rejectSelectedTitle"
            : "station.approval.rejectTitle",
        )}
        actions={
          <>
            <M3Button variant="text" onClick={closeReject}>
              {t("common.cancel")}
            </M3Button>
            <M3Button
              variant="destructive"
              loading={actionBusy}
              disabled={actionBusy}
              onClick={() => void submitReject()}
            >
              {t(
                rejectTarget?.kind === "bulk"
                  ? "station.approval.rejectSelected"
                  : "station.approval.rejectConfirm",
              )}
            </M3Button>
          </>
        }
      >
        <p>
          {t(
            rejectTarget?.kind === "bulk"
              ? "station.approval.bulkRejectDescription"
              : "station.approval.rejectDescription",
          )}
        </p>
        {rejectTarget?.kind === "single" && (
          <label className="approval-queue__reason">
            <span>{t("station.approval.rejectReason")}</span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.currentTarget.value)}
            />
          </label>
        )}
      </M3ModalDialog>
      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void revokeVoter()}
        title={t("station.approval.revokeTitle")}
        description={t("station.approval.revokeDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("station.approval.revokeConfirm")}
      />
      <ConfirmDialog
        open={blockTarget !== null}
        onClose={() => setBlockTarget(null)}
        onConfirm={() => void blockNumber()}
        title={t("station.approval.blockTitle")}
        description={t("station.approval.blockDescription")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("station.approval.blockConfirm")}
      />
      <M3ModalDialog
        open={reissuedToken !== null}
        onClose={closeReissuedToken}
        title={t("station.approval.reissueTitle")}
        actions={
          <>
            <M3Button variant="text" onClick={closeReissuedToken}>
              {t("common.close")}
            </M3Button>
            <M3Button onClick={() => void copyReissuedToken()}>
              {tokenCopied
                ? t("station.approval.tokenCopied")
                : t("station.approval.copyToken")}
            </M3Button>
          </>
        }
      >
        <p className="approval-queue__token-warning">
          {t("station.approval.tokenWarning")}
        </p>
        {reissuedToken && (
          <output
            className="approval-queue__token"
            aria-label={t("station.approval.newToken")}
          >
            {reissuedToken}
          </output>
        )}
      </M3ModalDialog>
    </section>
  );
}
