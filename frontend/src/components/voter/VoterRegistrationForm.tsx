"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { votingApi } from "@/lib/api/voting";
import { normalizePhoneInput, type NormalizedPhone } from "@/lib/shared";
import { useT } from "@/lib/i18n";
import { M3Banner, M3Button, M3TextField } from "@/components/ui/primitives";
import { PhoneField } from "@/components/ui/PhoneField";
import { DevicePrivacyNotice } from "./PrivacyNotice";
import { TokenDisplay } from "./TokenDisplay";
import { readVoterToken, storeVoterToken } from "@/lib/voter/voter-token";

export function VoterRegistrationForm({
  publicId,
  stationName,
  deviceId,
  fingerprint,
}: Readonly<{
  publicId: string;
  stationName: string;
  deviceId: string | null;
  fingerprint: string;
}>) {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<NormalizedPhone | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readVoterToken(publicId),
  );

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorKey(null);
    const phone = normalizedPhone ?? normalizePhoneInput(phoneInput);
    if (!fullName.trim()) {
      setErrorKey("voter.registration.fullNameRequired");
      return;
    }
    if (!phone.ok) {
      setErrorKey(`errors.phone.${phone.reason.toLowerCase()}`);
      return;
    }
    if (!deviceId) {
      setErrorKey("voter.registration.deviceUnavailable");
      return;
    }

    setBusy(true);
    try {
      const result = await votingApi.register(publicId, {
        fullName: fullName.trim(),
        phone: phone.canonical,
        deviceUuid: deviceId,
        fingerprintHash: fingerprint,
      });
      storeVoterToken(publicId, result.token);
      setToken(result.token);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.key === "errors.registration.already_registered") {
          setErrorKey("voter.registration.alreadyRegistered");
        } else if (error.key === "errors.registration.full") {
          setErrorKey("voter.registration.full");
        } else if (error.key === "errors.registration.closed") {
          setErrorKey("voter.registration.closed");
        } else if (error.key === "errors.registration.rate_limited") {
          setErrorKey("voter.registration.rateLimited");
        } else {
          setErrorKey(error.key);
        }
      } else {
        setErrorKey("voter.registration.networkError");
      }
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    return (
      <>
        <h1>{t("voter.registration.receivedTitle")}</h1>
        <p>{t("voter.registration.receivedStatus")}</p>
        <TokenDisplay token={token} />
        <Link className="ui-button ui-button--outlined" href={`/s/${encodeURIComponent(publicId)}/status`}>
          {t("voter.registration.viewStatus")}
        </Link>
      </>
    );
  }

  return (
    <form className="voter-registration-form" onSubmit={(event) => void submit(event)} noValidate>
      <h1>{t("voter.registration.title")}</h1>
      <p>{stationName}</p>
      <DevicePrivacyNotice />
      {errorKey && (
        <M3Banner variant="error">
          {t(errorKey)}
        </M3Banner>
      )}
      <M3TextField
        label={t("voter.registration.fullName")}
        value={fullName}
        onChange={(event) => setFullName(event.currentTarget.value)}
        helperText={t("voter.registration.fullNameHint")}
        autoComplete="name"
      />
      <PhoneField
        label={t("voter.registration.phone")}
        value={phoneInput}
        onChange={(event) => setPhoneInput(event.currentTarget.value)}
        onNormalizedChange={(phone) => setNormalizedPhone(phone)}
      />
      <M3Button type="submit" loading={busy} disabled={!deviceId || busy}>
        {t("voter.registration.register")}
      </M3Button>
    </form>
  );
}

