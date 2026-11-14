"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { M3Card, PageHeader } from "@/components/ui/primitives";

export function LegalPlaceholder({
  page,
}: Readonly<{ page: "terms" | "privacy" }>) {
  const t = useT();
  const title = page === "terms" ? t("home.terms") : t("home.privacy");

  return (
    <main className="auth-page">
      <M3Card className="auth-page-card">
        <PageHeader title={title} description={t("legal.placeholder")} />
        <Link href="/">{t("auth.backToSignIn")}</Link>
      </M3Card>
    </main>
  );
}
