"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useT } from "@/lib/i18n";

const LazyQRCode = dynamic(
  () => import("qrcode.react").then((module) => module.QRCodeSVG),
  { ssr: false },
);

export function MobileRequiredScreen() {
  const t = useT();
  const [pageUrl] = useState(() =>
    typeof window === "undefined" ? "" : window.location.href,
  );

  return (
    <main className="mobile-required" role="main">
      <section className="mobile-required__card">
        <h1>{t("voter.mobileRequired.title")}</h1>
        <p>{t("voter.mobileRequired.description")}</p>
        {pageUrl && (
          <div
            className="mobile-required__qr"
            aria-label={t("voter.mobileRequired.qrLabel")}
          >
            <LazyQRCode value={pageUrl} size={192} />
          </div>
        )}
      </section>
    </main>
  );
}
