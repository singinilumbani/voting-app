"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { useT } from "@/lib/i18n";
import {
  M3Button,
  M3Card,
  M3TextField,
  PageHeader,
  PasswordField,
} from "@/components/ui/primitives";

function AuthPageCard({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <main className="auth-page">
      <M3Card className="auth-page-card">
        <PageHeader title={title} description={description} />
        {children}
      </M3Card>
    </main>
  );
}

function errorKey(error: unknown): string {
  return error instanceof ApiError ? error.key : "errors.internal";
}

export function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("auth.validation.email");
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      router.push("/check-email");
    } catch (requestError) {
      setError(errorKey(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageCard
      title={t("auth.forgotTitle")}
      description={t("auth.forgotDescription")}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <M3TextField
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          required
          error={error ? t(error) : undefined}
        />
        <M3Button type="submit" loading={loading}>
          {t("auth.sendResetLink")}
        </M3Button>
      </form>
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function CheckEmailPage() {
  const t = useT();
  return (
    <AuthPageCard
      title={t("auth.checkEmailTitle")}
      description={t("auth.checkEmailDescription")}
    >
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function ResetPasswordPage({ token }: Readonly<{ token?: string }>) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12 || password.length > 256) {
      setError("auth.validation.password");
      return;
    }
    if (password !== confirmPassword) {
      setError("auth.validation.passwordMismatch");
      return;
    }
    if (!token) {
      router.push("/reset-link-expired");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      router.push("/reset-success");
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        requestError.key === "errors.host_auth.reset_token_invalid"
      ) {
        router.push("/reset-link-expired");
      } else {
        setError(errorKey(requestError));
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <ExpiredLinkPage />;

  return (
    <AuthPageCard
      title={t("auth.resetTitle")}
      description={t("auth.resetDescription")}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <PasswordField
          label={t("auth.password")}
          autoComplete="new-password"
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
          error={error ? t(error) : undefined}
        />
        <PasswordField
          label={t("auth.confirmPassword")}
          autoComplete="new-password"
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.currentTarget.value)}
          required
          error={
            error === "auth.validation.passwordMismatch" ? t(error) : undefined
          }
        />
        <M3Button type="submit" loading={loading}>
          {t("auth.resetPassword")}
        </M3Button>
      </form>
    </AuthPageCard>
  );
}

export function ResetSuccessPage() {
  const t = useT();
  return (
    <AuthPageCard
      title={t("auth.resetSuccessTitle")}
      description={t("auth.resetSuccessDescription")}
    >
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function ExpiredLinkPage() {
  const t = useT();
  return (
    <AuthPageCard
      title={t("auth.expiredLinkTitle")}
      description={t("auth.expiredLinkDescription")}
    >
      <Link href="/forgot-password">{t("auth.sendResetLink")}</Link>
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function VerificationPendingPage() {
  const t = useT();
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds === 0) return;
    const timer = window.setTimeout(
      () => setSeconds((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [seconds]);

  return (
    <AuthPageCard
      title={t("auth.verificationPendingTitle")}
      description={t("auth.verificationPendingDescription")}
    >
      <M3Button type="button" disabled>
        {t("auth.verificationResend")}
      </M3Button>
      <p role="status">
        {seconds > 0
          ? t("auth.verificationResendCooldown", { seconds })
          : t("auth.verificationResendUnavailable")}
      </p>
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function VerifyEmailPage({ token }: Readonly<{ token?: string }>) {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!token) {
      router.replace("/verification-link-expired");
      return () => {
        active = false;
      };
    }

    void authApi
      .verifyEmail(token)
      .then(() => {
        if (active) router.replace("/verify-email-verified");
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (
          error instanceof ApiError &&
          error.key === "errors.host_auth.verification_token_invalid"
        ) {
          router.replace("/verification-link-expired");
        } else {
          setMessage(errorKey(error));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <AuthPageCard
      title={t("auth.verificationPendingTitle")}
      description={
        message ? t(message) : t("auth.verificationPendingDescription")
      }
    >
      {loading && <p role="status">{t("auth.verificationChecking")}</p>}
    </AuthPageCard>
  );
}

export function VerificationVerifiedPage() {
  const t = useT();
  return (
    <AuthPageCard
      title={t("auth.verificationTitle")}
      description={t("auth.verificationDescription")}
    >
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}

export function VerificationExpiredPage() {
  const t = useT();
  return (
    <AuthPageCard
      title={t("auth.expiredLinkTitle")}
      description={t("auth.expiredLinkDescription")}
    >
      <p>{t("auth.verificationResendUnavailable")}</p>
      <Link href="/">{t("auth.backToSignIn")}</Link>
    </AuthPageCard>
  );
}
