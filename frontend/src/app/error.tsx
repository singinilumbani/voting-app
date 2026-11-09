"use client";

import { M3Button, M3Card } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export default function ErrorPage({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const t = useT();
  return (
    <main className="global-status-page">
      <M3Card>
        <h1>{t("global.errorTitle")}</h1>
        <p>{t("global.errorDescription")}</p>
        <M3Button onClick={reset}>{t("global.tryAgain")}</M3Button>
      </M3Card>
    </main>
  );
}
