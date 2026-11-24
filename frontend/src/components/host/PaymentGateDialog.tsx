"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { M3Button } from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";
import { useT } from "@/lib/i18n";

export function PaymentGateDialog({
  open,
  onClose,
}: Readonly<{ open: boolean; onClose: () => void }>) {
  const t = useT();
  const router = useRouter();
  const [annual, setAnnual] = useState(false);

  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      title={t("billing.paymentGateTitle")}
      actions={
        <>
          <M3Button variant="text" onClick={onClose}>
            {t("common.cancel")}
          </M3Button>
          <M3Button
            onClick={() => {
              router.push("/host/billing");
            }}
          >
            {t("billing.paymentGateContinue")}
          </M3Button>
        </>
      }
    >
      <p>{t("billing.paymentGateDescription")}</p>
      <div className="billing-gate__options">
        <button type="button" onClick={() => setAnnual(false)}>
          {t("billing.payPerUse")}
        </button>
        <button type="button" onClick={() => setAnnual(true)}>
          {annual
            ? t("billing.annual")
            : t("billing.monthly")}
        </button>
      </div>
    </M3ModalDialog>
  );
}
