"use client";

import { useState } from "react";
import { M3Button } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export function TokenDisplay({
  token,
}: Readonly<{ token: string }>) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);

  async function copyToken(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setFeedbackKey(null);
    } catch {
      setCopied(false);
      setFeedbackKey("voter.token.copyError");
    }
  }

  async function shareToken(): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("voter.token.shareTitle"),
          text: token,
        });
        setFeedbackKey(null);
        return;
      }
      await copyToken();
    } catch {
      await copyToken();
    }
  }

  return (
    <section className="voter-token" aria-label={t("voter.token.label")}>
      <output className="voter-token__value" aria-label={t("voter.token.value")}>
        {token}
      </output>
      <div className="voter-token__actions">
        <M3Button type="button" variant="outlined" onClick={() => void copyToken()}>
          {copied ? t("voter.token.copied") : t("voter.token.copy")}
        </M3Button>
        <M3Button type="button" onClick={() => void shareToken()}>
          {t("voter.token.share")}
        </M3Button>
      </div>
      {feedbackKey && <p role="alert">{t(feedbackKey)}</p>}
      <p className="voter-token__warning">{t("voter.token.warning")}</p>
    </section>
  );
}

