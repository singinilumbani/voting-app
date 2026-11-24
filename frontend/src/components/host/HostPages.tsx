"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { HostDto } from "@/lib/api/schemas";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  M3Button,
  M3Card,
  M3TextField,
  PageHeader,
  PasswordField,
} from "@/components/ui/primitives";
import { M3ModalDialog, TypedConfirmDialog } from "@/components/ui/dialogs";
import { useT } from "@/lib/i18n";
import { sessionQueryKey, useLogout, useSession } from "@/lib/session";
import type { AccountType } from "@/components/auth/types";
import { StationDashboard } from "@/components/host/StationDashboard";

function requestError(error: unknown): string {
  return error instanceof ApiError ? error.key : "errors.internal";
}

export function HostShell({ children }: Readonly<{ children: ReactNode }>) {
  const t = useT();
  const router = useRouter();
  const logout = useLogout();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutError(null);
    try {
      await logout();
      router.push("/");
    } catch (error) {
      setLogoutError(requestError(error));
    }
  }

  return (
    <AppShell
      branding={t("metadata.title")}
      profileHref="/host/profile"
      profileLabel={t("navigation.profile")}
      logoutLabel={t("navigation.logout")}
      menuLabel={t("navigation.openMenu")}
      closeMenuLabel={t("navigation.closeMenu")}
      billingHref="/host/billing"
      billingLabel={t("navigation.billing")}
      onLogout={() => void handleLogout()}
    >
      {logoutError && (
        <p className="auth-error" role="alert">
          {t(logoutError)}
        </p>
      )}
      {children}
    </AppShell>
  );
}

export function SessionGate({ children }: Readonly<{ children: ReactNode }>) {
  const t = useT();
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/");
  }, [router, session.status]);

  if (session.status === "loading") {
    return <p role="status">{t("host.loading")}</p>;
  }
  if (session.status === "unauthenticated") {
    return null;
  }
  if (session.status === "error") {
    return <p role="alert">{t(requestError(session.error))}</p>;
  }
  return children;
}

export function HostDashboardPage() {
  return (
    <SessionGate>
      <HostShell>
        <DashboardContent />
      </HostShell>
    </SessionGate>
  );
}

function DashboardContent() {
  const session = useSession();
  return session.status === "authenticated" ? (
    <StationDashboard host={session.host} />
  ) : null;
}

type HostProfileSettingsProps = Readonly<{
  host: HostDto;
  onAccountDeleted: () => void;
  onVerificationRequired: () => void;
}>;

export function HostProfileSettings({
  host: initialHost,
  onAccountDeleted,
  onVerificationRequired,
}: HostProfileSettingsProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [host, setHost] = useState(initialHost);
  const [username, setUsername] = useState(initialHost.username);
  const [email, setEmail] = useState(initialHost.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [noticeTier, setNoticeTier] = useState<AccountType | null>(null);
  const [confirmTier, setConfirmTier] = useState<AccountType | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const changes: { username?: string; email?: string } = {};
    if (username !== host.username) changes.username = username;
    if (email !== host.email) changes.email = email;
    if (Object.keys(changes).length === 0) return;

    setBusy(true);
    try {
      const response = await authApi.updateProfile(changes);
      setHost(response.host);
      queryClient.setQueryData(sessionQueryKey, { host: response.host });
      setUsername(response.host.username);
      setEmail(response.host.email);
      if (response.verificationRequired) onVerificationRequired();
      else setMessage(t("host.profileSaved"));
    } catch (requestFailure) {
      setError(requestError(requestFailure));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword.length < 12 || newPassword.length > 256) {
      setError("auth.validation.password");
      return;
    }

    setBusy(true);
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t(response.messageKey));
    } catch (requestFailure) {
      setError(requestError(requestFailure));
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(target: AccountType, confirm?: "DELETE") {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const response = await authApi.changeTier({
        accountType: target,
        ...(confirm ? { confirm } : {}),
      });
      setHost(response.host);
      queryClient.setQueryData(sessionQueryKey, { host: response.host });
      setNoticeTier(null);
      setConfirmTier(null);
      setMessage(t("host.profileSaved"));
    } catch (requestFailure) {
      setError(requestError(requestFailure));
      setNoticeTier(null);
      setConfirmTier(null);
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setError(null);
    setBusy(true);
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "voting-app-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestFailure) {
      setError(requestError(requestFailure));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setError(null);
    setBusy(true);
    try {
      await authApi.deleteAccount();
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      setDeleteOpen(false);
      onAccountDeleted();
    } catch (requestFailure) {
      setError(requestError(requestFailure));
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const targetTier: AccountType =
    host.accountType === "TEMPORARY" ? "LONG_TERM" : "TEMPORARY";
  const noticeText =
    noticeTier === "LONG_TERM"
      ? t("auth.longTermNotice")
      : t("auth.temporaryNotice");
  const noticeTitle =
    noticeTier === "LONG_TERM"
      ? t("auth.longTermNoticeTitle")
      : t("auth.temporaryNoticeTitle");

  return (
    <main className="host-page">
      <PageHeader title={t("host.profileTitle")} />
      {error && (
        <p className="auth-error" role="alert">
          {t(error)}
        </p>
      )}
      {message && (
        <p className="host-success" role="status">
          {message}
        </p>
      )}
      <div className="host-profile-grid">
        <M3Card>
          <h2>{t("host.profileTitle")}</h2>
          <p>
            {t("host.accountCreated")}:{" "}
            {new Date(host.createdAt).toLocaleDateString()}
          </p>
          <form className="auth-form" onSubmit={saveProfile} noValidate>
            <M3TextField
              label={t("auth.username")}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
              required
            />
            <M3TextField
              label={t("auth.email")}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <M3Button type="submit" loading={busy}>
              {t("host.saveProfile")}
            </M3Button>
          </form>
        </M3Card>
        <M3Card>
          <h2>{t("host.changePassword")}</h2>
          <form className="auth-form" onSubmit={savePassword} noValidate>
            <PasswordField
              label={t("host.currentPassword")}
              autoComplete="current-password"
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(event.currentTarget.value)
              }
              required
            />
            <PasswordField
              label={t("host.newPassword")}
              autoComplete="new-password"
              showPasswordLabel={t("auth.showPassword")}
              hidePasswordLabel={t("auth.hidePassword")}
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              required
              error={
                error === "auth.validation.password" ? t(error) : undefined
              }
            />
            <M3Button type="submit" loading={busy}>
              {t("host.changePassword")}
            </M3Button>
          </form>
        </M3Card>
        <M3Card>
          <h2>{t("host.tierTitle")}</h2>
          <p>
            {t(
              host.accountType === "TEMPORARY"
                ? "auth.temporaryAccount"
                : "auth.longTermAccount",
            )}
          </p>
          <M3Button
            variant="outlined"
            disabled={busy}
            onClick={() => setNoticeTier(targetTier)}
          >
            {t("host.changeTier")}
          </M3Button>
        </M3Card>
        <M3Card className="host-profile-actions">
          <h2>{t("host.profileActions")}</h2>
          <M3Button
            variant="tonal"
            disabled={busy}
            onClick={() => void exportData()}
          >
            {t("host.exportData")}
          </M3Button>
          <M3Button
            variant="destructive"
            disabled={busy}
            onClick={() => setDeleteOpen(true)}
          >
            {t("host.deleteAccount")}
          </M3Button>
        </M3Card>
      </div>

      <M3ModalDialog
        open={noticeTier !== null}
        onClose={() => setNoticeTier(null)}
        title={noticeTitle}
        actions={
          <>
            <M3Button variant="text" onClick={() => setNoticeTier(null)}>
              {t("auth.goBack")}
            </M3Button>
            <M3Button
              disabled={busy}
              onClick={() => {
                if (noticeTier === "TEMPORARY") setConfirmTier("TEMPORARY");
                else void changeTier("LONG_TERM");
                setNoticeTier(null);
              }}
            >
              {t("auth.understandContinue")}
            </M3Button>
          </>
        }
      >
        <p>{noticeText}</p>
      </M3ModalDialog>

      <TypedConfirmDialog
        open={confirmTier !== null}
        onClose={() => setConfirmTier(null)}
        onConfirm={() => void changeTier("TEMPORARY", "DELETE")}
        title={t("host.confirmTierTitle")}
        description={t("host.confirmTierDescription")}
        word="DELETE"
        inputLabel={t("host.confirmWordLabel")}
        cancelLabel={t("auth.goBack")}
        confirmLabel={t("host.confirmTierButton")}
      />
      <TypedConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteAccount()}
        title={t("host.confirmDeleteTitle")}
        description={t("host.confirmDeleteDescription")}
        word="DELETE"
        inputLabel={t("host.confirmWordLabel")}
        cancelLabel={t("auth.goBack")}
        confirmLabel={t("host.confirmDeleteButton")}
      />
    </main>
  );
}

export function HostProfilePage() {
  const t = useT();
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/");
  }, [router, session.status]);
  if (session.status === "loading") {
    return (
      <HostShell>
        <p role="status">{t("host.loading")}</p>
      </HostShell>
    );
  }
  if (session.status === "unauthenticated") {
    return null;
  }
  if (session.status === "error") {
    return (
      <HostShell>
        <p role="alert">{t(requestError(session.error))}</p>
      </HostShell>
    );
  }

  return (
    <HostShell>
      <HostProfileSettings
        host={session.host}
        onAccountDeleted={() => router.replace("/")}
        onVerificationRequired={() => router.push("/verify-email-pending")}
      />
    </HostShell>
  );
}
