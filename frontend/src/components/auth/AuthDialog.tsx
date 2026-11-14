"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { sessionQueryKey } from "@/lib/session";
import { useT } from "@/lib/i18n";
import {
  Checkbox,
  M3Button,
  M3TextField,
  PasswordField,
} from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";
import type { AccountType } from "./types";

type AuthDialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  onVerificationRequired: (email: string) => void;
}>;

type AuthScreen = "signin" | "tier-choice" | "tier-notice" | "signup";
type FormErrors = Readonly<Record<string, string>>;

function isValidPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 256;
}

function passwordScore(password: string): number {
  if (!password) return 0;
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return Math.min(
    3,
    (password.length >= 12 ? 1 : 0) +
      (classes >= 3 ? 1 : 0) +
      (password.length >= 16 && classes >= 3 ? 1 : 0),
  );
}

function translatedError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.key : fallback;
}

export function AuthDialog({
  open,
  onClose,
  onAuthenticated,
  onVerificationRequired,
}: AuthDialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const formId = useId();
  const [screen, setScreen] = useState<AuthScreen>("signin");
  const [accountType, setAccountType] = useState<AccountType>("TEMPORARY");
  const [noticeTier, setNoticeTier] = useState<AccountType>("TEMPORARY");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setScreen("signin");
    setErrors({});
    setRequestError(null);
    setLoading(false);
  }

  function close() {
    resetForm();
    onClose();
  }

  const title =
    screen === "signin"
      ? t("auth.signIn")
      : screen === "tier-choice"
        ? t("auth.signupStep1")
        : screen === "tier-notice"
          ? noticeTier === "TEMPORARY"
            ? t("auth.temporaryNoticeTitle")
            : t("auth.longTermNoticeTitle")
          : t("auth.signupStep2");

  async function completeSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError(null);
    const form = new FormData(event.currentTarget);
    const nextUsername = String(form.get("username") ?? "");
    const nextPassword = String(form.get("password") ?? "");
    const nextErrors: Record<string, string> = {};
    if (!/^[A-Za-z0-9]{3,80}$/.test(nextUsername)) {
      nextErrors.username = t("auth.validation.username");
    }
    if (!isValidPassword(nextPassword)) {
      nextErrors.password = t("auth.validation.password");
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login({
        username: nextUsername,
        password: nextPassword,
      });
      queryClient.setQueryData(sessionQueryKey, response);
      close();
      onAuthenticated();
    } catch (error) {
      setRequestError(translatedError(error, "errors.internal"));
    } finally {
      setLoading(false);
    }
  }

  async function completeSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError(null);
    const nextErrors: Record<string, string> = {};
    if (!/^[A-Za-z0-9]{3,80}$/.test(username)) {
      nextErrors.username = t("auth.validation.username");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = t("auth.validation.email");
    }
    if (!isValidPassword(password)) {
      nextErrors.password = t("auth.validation.password");
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = t("auth.validation.passwordMismatch");
    }
    if (!termsAccepted) {
      nextErrors.terms = t("auth.termsRequired");
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.signup({
        username,
        email,
        password,
        accountType,
        termsAccepted: true,
      });
      if (result.verificationRequired) {
        close();
        onVerificationRequired(email);
      } else {
        await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
        close();
        onAuthenticated();
      }
    } catch (error) {
      setRequestError(translatedError(error, "errors.internal"));
    } finally {
      setLoading(false);
    }
  }

  const actions =
    screen === "signin" ? (
      <>
        <M3Button variant="text" type="button" onClick={close}>
          {t("global.dismiss")}
        </M3Button>
        <M3Button type="submit" form={`${formId}-signin`} loading={loading}>
          {t("auth.signIn")}
        </M3Button>
      </>
    ) : screen === "tier-choice" ? (
      <M3Button
        variant="text"
        type="button"
        onClick={() => setScreen("signin")}
      >
        {t("auth.goBack")}
      </M3Button>
    ) : screen === "tier-notice" ? (
      <>
        <M3Button
          variant="text"
          type="button"
          onClick={() => setScreen("tier-choice")}
        >
          {t("auth.goBack")}
        </M3Button>
        <M3Button
          type="button"
          onClick={() => {
            setAccountType(noticeTier);
            setScreen("signup");
          }}
        >
          {t("auth.understandContinue")}
        </M3Button>
      </>
    ) : (
      <>
        <M3Button
          variant="text"
          type="button"
          onClick={() => setScreen("tier-choice")}
        >
          {t("auth.goBack")}
        </M3Button>
        <M3Button type="submit" form={`${formId}-signup`} loading={loading}>
          {t("auth.createAccount")}
        </M3Button>
      </>
    );

  return (
    <M3ModalDialog
      open={open}
      onClose={close}
      title={title}
      className="auth-dialog"
      actions={actions}
    >
      {requestError && (
        <p className="auth-error" role="alert">
          {t(requestError)}
        </p>
      )}
      {screen === "signin" && (
        <form
          id={`${formId}-signin`}
          className="auth-form"
          onSubmit={completeSignIn}
          noValidate
        >
          <M3TextField
            name="username"
            label={t("auth.username")}
            autoComplete="username"
            required
            error={errors.username}
          />
          <PasswordField
            name="password"
            label={t("auth.password")}
            autoComplete="current-password"
            showPasswordLabel={t("auth.showPassword")}
            hidePasswordLabel={t("auth.hidePassword")}
            required
            error={errors.password}
          />
          <Link href="/forgot-password" onClick={close}>
            {t("auth.forgotPassword")}
          </Link>
          <p>
            {t("auth.noAccount")}{" "}
            <button
              type="button"
              className="ui-link-button"
              onClick={() => setScreen("tier-choice")}
            >
              {t("auth.signUp")}
            </button>
          </p>
        </form>
      )}
      {screen === "tier-choice" && (
        <div className="auth-tier-list">
          <button
            type="button"
            className="auth-tier-card"
            aria-pressed={accountType === "TEMPORARY"}
            onClick={() => {
              setNoticeTier("TEMPORARY");
              setScreen("tier-notice");
            }}
          >
            <strong>{t("auth.temporaryAccount")}</strong>
            <span>{t("auth.temporarySummary")}</span>
          </button>
          <button
            type="button"
            className="auth-tier-card"
            aria-pressed={accountType === "LONG_TERM"}
            onClick={() => {
              setNoticeTier("LONG_TERM");
              setScreen("tier-notice");
            }}
          >
            <strong>{t("auth.longTermAccount")}</strong>
            <span>{t("auth.longTermSummary")}</span>
          </button>
          <p>
            {t("auth.haveAccount")}{" "}
            <button
              type="button"
              className="ui-link-button"
              onClick={() => setScreen("signin")}
            >
              {t("auth.signIn")}
            </button>
          </p>
        </div>
      )}
      {screen === "tier-notice" && (
        <p>
          {t(
            noticeTier === "TEMPORARY"
              ? "auth.temporaryNotice"
              : "auth.longTermNotice",
          )}
        </p>
      )}
      {screen === "signup" && (
        <form
          id={`${formId}-signup`}
          className="auth-form"
          onSubmit={completeSignUp}
          noValidate
        >
          <p>{t("auth.signupStep2")}</p>
          <M3TextField
            name="username"
            label={t("auth.username")}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
            required
            error={errors.username}
          />
          <M3TextField
            name="email"
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            error={errors.email}
          />
          <PasswordField
            name="password"
            label={t("auth.password")}
            autoComplete="new-password"
            showPasswordLabel={t("auth.showPassword")}
            hidePasswordLabel={t("auth.hidePassword")}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            error={errors.password}
          />
          <div className="auth-password-meter">
            <span>{t("auth.passwordStrength")}</span>
            <progress
              max={3}
              value={passwordScore(password)}
              aria-label={t("auth.passwordStrength")}
            />
            <span>
              {t(
                passwordScore(password) <= 1
                  ? "auth.strengthWeak"
                  : passwordScore(password) === 2
                    ? "auth.strengthFair"
                    : "auth.strengthStrong",
              )}
            </span>
          </div>
          <p className="auth-password-rule">{t("auth.passwordRuleLength")}</p>
          <PasswordField
            name="confirmPassword"
            label={t("auth.confirmPassword")}
            autoComplete="new-password"
            showPasswordLabel={t("auth.showPassword")}
            hidePasswordLabel={t("auth.hidePassword")}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            required
            error={errors.confirmPassword}
          />
          <div>
            <div className={errors.terms ? "auth-terms-error" : ""}>
              <Checkbox
                label={t("auth.termsAcceptance")}
                checked={termsAccepted}
                onChange={(event) =>
                  setTermsAccepted(event.currentTarget.checked)
                }
                error={errors.terms}
              />
              <span className="auth-terms-links">
                <Link href="/terms" target="_blank" rel="noreferrer">
                  {t("home.terms")}
                </Link>{" "}
                {t("auth.and")}{" "}
                <Link href="/privacy" target="_blank" rel="noreferrer">
                  {t("home.privacy")}
                </Link>
              </span>
            </div>
          </div>
          <input type="hidden" name="accountType" value={accountType} />
        </form>
      )}
    </M3ModalDialog>
  );
}
