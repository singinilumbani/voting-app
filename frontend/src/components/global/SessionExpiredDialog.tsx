"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { NoticeDialog } from "@/components/ui/dialogs";
import { sessionQueryKey } from "@/lib/session";
import { useT } from "@/lib/i18n";

export function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useT();

  useEffect(() => {
    const show = () => {
      if (queryClient.getQueryData(sessionQueryKey)) setOpen(true);
    };
    window.addEventListener("vote:session-expired", show);
    return () => window.removeEventListener("vote:session-expired", show);
  }, [queryClient]);

  function dismiss() {
    setOpen(false);
    void queryClient.removeQueries({ queryKey: sessionQueryKey });
    router.push("/");
  }

  return (
    <NoticeDialog
      open={open}
      onClose={dismiss}
      title={t("global.sessionExpiredTitle")}
      closeLabel={t("global.returnHome")}
    >
      <p>{t("global.sessionExpiredDescription")}</p>
    </NoticeDialog>
  );
}
