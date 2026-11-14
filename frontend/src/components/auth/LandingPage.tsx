"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthDialog } from "./AuthDialog";
import { parsePollPublicId } from "@/lib/poll-link";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import { M3Button, M3Card, M3TextField } from "@/components/ui/primitives";

export function LandingPage() {
  const t = useT();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [pollValue, setPollValue] = useState("");
  const [pollError, setPollError] = useState(false);

  function joinPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publicId = parsePollPublicId(pollValue);
    if (!publicId) {
      setPollError(true);
      return;
    }
    router.push(`/s/${encodeURIComponent(publicId)}`);
  }

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="app-brand">
          {t("metadata.title")}
        </Link>
        <M3Button onClick={() => setAuthOpen(true)}>
          {t("home.signInSignUp")}
        </M3Button>
      </header>
      <section className="landing-hero">
        <div>
          <p className="landing-eyebrow">{t("metadata.description")}</p>
          <h1>{t("home.title")}</h1>
          <p>{t("home.description")}</p>
          <M3Button onClick={() => setAuthOpen(true)}>
            {t("home.signInSignUp")}
          </M3Button>
        </div>
        <M3Card className="landing-join-card">
          <h2>{t("home.joinTitle")}</h2>
          <p>{t("home.joinDescription")}</p>
          <form onSubmit={joinPoll} className="landing-join-form" noValidate>
            <M3TextField
              label={t("home.pollLinkLabel")}
              value={pollValue}
              onChange={(event) => {
                setPollValue(event.currentTarget.value);
                setPollError(false);
              }}
              error={pollError ? t("home.invalidPollLink") : undefined}
              autoComplete="url"
              required
            />
            <M3Button type="submit">{t("home.joinPoll")}</M3Button>
          </form>
        </M3Card>
      </section>
      <section
        className="landing-features"
        aria-labelledby="landing-features-title"
      >
        <h2 id="landing-features-title">{t("home.featureTitle")}</h2>
        <div className="landing-feature-grid">
          <M3Card>
            <Icon name="lock" />
            <h3>{t("home.features.private")}</h3>
            <p>{t("home.features.privateDescription")}</p>
          </M3Card>
          <M3Card>
            <Icon name="link" />
            <h3>{t("home.features.simple")}</h3>
            <p>{t("home.features.simpleDescription")}</p>
          </M3Card>
          <M3Card>
            <Icon name="analytics" />
            <h3>{t("home.features.insightful")}</h3>
            <p>{t("home.features.insightfulDescription")}</p>
          </M3Card>
        </div>
      </section>
      <footer className="landing-footer">
        <Link href="/terms">{t("home.terms")}</Link>
        <Link href="/privacy">{t("home.privacy")}</Link>
      </footer>
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => router.push("/host")}
        onVerificationRequired={() => router.push("/verify-email-pending")}
      />
    </main>
  );
}
