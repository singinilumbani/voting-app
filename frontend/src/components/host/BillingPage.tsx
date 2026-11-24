"use client";

import { useState } from "react";
import Link from "next/link";
import { getPublicEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import {
  M3Banner,
  M3Button,
  M3Card,
  StatusBadge,
} from "@/components/ui/primitives";
import { HostShell, SessionGate } from "./HostPages";

type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export type BillingPageProps = Readonly<{
  initialStatus?: PaymentStatus;
}>;

export function BillingPage({ initialStatus }: BillingPageProps) {
  const t = useT();
  const session = useSession();
  const [annual, setAnnual] = useState(false);
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus | null>(initialStatus ?? null);
  const [busy, setBusy] = useState(false);
  const paymentsEnabled =
    getPublicEnv().NEXT_PUBLIC_ENABLE_PAYMENTS === "true";

  function startPayment(status: PaymentStatus = "PENDING"): void {
    setBusy(true);
    setPaymentStatus(status);
    window.setTimeout(() => setBusy(false), 300);
  }

  if (!paymentsEnabled) {
    return (
      <SessionGate>
        <HostShell>
          <main className="host-page">
            <M3Card className="billing-page__disabled">
              <h1>{t("billing.title")}</h1>
              <M3Banner variant="info">
                {t("billing.betaDisabled")}
              </M3Banner>
              <Link className="ui-button ui-button--outlined" href="/host">
                {t("billing.backToDashboard")}
              </Link>
            </M3Card>
          </main>
        </HostShell>
      </SessionGate>
    );
  }

  const statusTone =
    paymentStatus === "SUCCESSFUL"
      ? "success"
      : paymentStatus === "FAILED"
        ? "error"
        : "warning";

  return (
    <SessionGate>
      <HostShell>
        <main className="host-page billing-page">
          <h1>{t("billing.title")}</h1>
          {session.status === "authenticated" && (
            <M3Card className="billing-page__current">
              <h2>{t("billing.currentPlan")}</h2>
              <strong>{session.host.plan}</strong>
              <p>{t("billing.currentPlanDescription")}</p>
            </M3Card>
          )}
          <section className="billing-page__plans" aria-label={t("billing.plans")}>
            <M3Card>
              <h2>{t("billing.payPerUse")}</h2>
              <p>{t("billing.payPerUseDescription")}</p>
              <div className="billing-page__providers" aria-label={t("billing.providers")}>
                <span>{t("billing.providerAirtel")}</span>
                <span>{t("billing.providerTnm")}</span>
                <span>{t("billing.providerCard")}</span>
              </div>
              <M3Button
                loading={busy}
                onClick={() => startPayment("PENDING")}
              >
                {t("billing.checkout")}
              </M3Button>
            </M3Card>
            <M3Card>
              <h2>{t("billing.premium")}</h2>
              <div className="billing-page__toggle" role="group">
                <M3Button
                  variant={!annual ? "filled" : "outlined"}
                  onClick={() => setAnnual(false)}
                >
                  {t("billing.monthly")}
                </M3Button>
                <M3Button
                  variant={annual ? "filled" : "outlined"}
                  onClick={() => setAnnual(true)}
                >
                  {t("billing.annual")}
                </M3Button>
              </div>
              <p>
                {annual
                  ? t("billing.premiumAnnualDescription")
                  : t("billing.premiumMonthlyDescription")}
              </p>
              <M3Button
                variant="outlined"
                loading={busy}
                onClick={() => startPayment("PENDING")}
              >
                {t("billing.managePremium")}
              </M3Button>
            </M3Card>
          </section>
          {paymentStatus && (
            <M3Card className="billing-page__payment">
              <h2>{t("billing.paymentState")}</h2>
              <StatusBadge status={statusTone}>
                {t(`billing.status.${paymentStatus.toLowerCase()}`)}
              </StatusBadge>
              {paymentStatus === "FAILED" && (
                <M3Button
                  variant="destructive"
                  onClick={() => startPayment("PENDING")}
                >
                  {t("billing.retry")}
                </M3Button>
              )}
              {paymentStatus === "SUCCESSFUL" && (
                <M3Button
                  variant="outlined"
                  onClick={() => {
                    const blob = new Blob(
                      [t("billing.receiptText")],
                      { type: "text/plain;charset=utf-8" },
                    );
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "payment-receipt.txt";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  {t("billing.downloadReceipt")}
                </M3Button>
              )}
            </M3Card>
          )}
        </main>
      </HostShell>
    </SessionGate>
  );
}
