"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicStation } from "@/components/voter/PublicStationContext";
import { TokenDisplay } from "@/components/voter/TokenDisplay";
import { readVoterToken } from "@/lib/voter/voter-token";
import { usePollingInterval } from "@/lib/polling";
import { votingApi } from "@/lib/api/voting";
import { ApiError } from "@/lib/api/client";
import {
  M3Banner,
  M3Button,
  M3Card,
  StatusBadge,
} from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

type VoterStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

export default function VoterStatusPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const t = useT();
  const station = usePublicStation();
  const [publicId, setPublicId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<VoterStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingInterval = usePollingInterval(30_000);

  useEffect(() => {
    let active = true;
    void params.then((value) => {
      if (!active) return;
      setPublicId(value.publicId);
      setToken(readVoterToken(value.publicId));
    });
    return () => {
      active = false;
    };
  }, [params]);

  async function checkStatus(): Promise<void> {
    if (!publicId || !token) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const result = await votingApi.status(publicId, token);
      setStatus(result.status);
      setRejectionReason(result.rejectionReason ?? null);
    } catch (error) {
      setErrorKey(
        error instanceof ApiError
          ? error.key
          : "voter.status.networkError",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!publicId || !token) return;
    const timer = window.setTimeout(() => void checkStatus(), 0);
    return () => window.clearTimeout(timer);
    // checkStatus is triggered by the publicId and token values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId, token]);

  useEffect(() => {
    if (pollingInterval === false || !publicId || !token) return;
    const timer = window.setInterval(() => void checkStatus(), pollingInterval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingInterval, publicId, token]);

  if (!token) {
    return (
      <main className="voter-page">
        <M3Card className="voter-page__card">
          <h1>{t("voter.status.title")}</h1>
          <M3Banner variant="warning">
            {t("voter.status.missingToken")}
          </M3Banner>
          <Link
            className="ui-button ui-button--outlined"
            href={`/s/${encodeURIComponent(publicId)}`}
          >
            {t("voter.status.backToStation")}
          </Link>
        </M3Card>
      </main>
    );
  }

  const statusCopy: Record<
    VoterStatus,
    {
      key: string;
      tone: "neutral" | "success" | "warning" | "error";
    }
  > = {
    PENDING: { key: "voter.status.pending", tone: "warning" },
    APPROVED: { key: "voter.status.approved", tone: "success" },
    REJECTED: { key: "voter.status.rejected", tone: "error" },
    REVOKED: { key: "voter.status.revoked", tone: "error" },
  };

  return (
    <main className="voter-page">
      <M3Card className="voter-page__card">
        <h1>{t("voter.status.title")}</h1>
        {station && <p>{station.name}</p>}
        {errorKey && (
          <M3Banner variant="error">
            {t(errorKey)}
            <M3Button variant="text" onClick={() => void checkStatus()}>
              {t("voter.status.retry")}
            </M3Button>
          </M3Banner>
        )}
        {status && (
          <>
            <StatusBadge status={statusCopy[status].tone}>
              {t(statusCopy[status].key)}
            </StatusBadge>
            {status === "REJECTED" && rejectionReason && (
              <p>
                {t("voter.status.rejectionReason", {
                  reason: rejectionReason,
                })}
              </p>
            )}
            {status === "REJECTED" && (
              <Link
                className="ui-button ui-button--outlined"
                href={`/s/${encodeURIComponent(publicId)}/register`}
              >
                {t("voter.status.registerAgain")}
              </Link>
            )}
            {status === "REVOKED" && (
              <p>{t("voter.status.contactHost")}</p>
            )}
            {status === "APPROVED" && (
              <p>{t("voter.status.approvedHint")}</p>
            )}
          </>
        )}
        <M3Button
          type="button"
          loading={busy}
          onClick={() => void checkStatus()}
        >
          {t("voter.status.check")}
        </M3Button>
        <TokenDisplay token={token} />
      </M3Card>
    </main>
  );
}
