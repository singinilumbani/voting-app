"use client";

import { M3Button, M3Card } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export default function PublicStationError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const t = useT();
  return (
    <main className="voter-page">
      <M3Card className="voter-page__card">
        <h1>{t("global.errorTitle")}</h1>
        <p>{t("global.errorDescription")}</p>
        <M3Button onClick={reset}>{t("global.tryAgain")}</M3Button>
      </M3Card>
    </main>
  );
}
