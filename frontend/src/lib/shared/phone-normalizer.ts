import { MALAWI_COUNTRY_CODE, MALAWI_MOBILE_PREFIXES } from "./constants";

export type PhoneNormalizationReason =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NOT_MOBILE"
  | "SPREADSHEET_DAMAGED"
  | "EMPTY"
  | "INVALID_CHARACTERS";

export type NormalizedPhone = Readonly<{
  ok: true;
  canonical: string;
  display: string;
  isInternational: boolean;
  whatsappUrl?: string;
}>;

export type InvalidPhone = Readonly<{
  ok: false;
  reason: PhoneNormalizationReason;
}>;

export type PhoneNormalizationResult = NormalizedPhone | InvalidPhone;

function invalid(reason: PhoneNormalizationReason): InvalidPhone {
  return { ok: false, reason };
}

function formatMalawiDisplay(national: string): string {
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

function normalizeMalawiNational(national: string): PhoneNormalizationResult {
  if (national.length < 9) return invalid("TOO_SHORT");
  if (national.length > 9) return invalid("TOO_LONG");
  if (!MALAWI_MOBILE_PREFIXES.some((prefix) => national.startsWith(prefix))) {
    return invalid("NOT_MOBILE");
  }

  return {
    ok: true,
    canonical: `${MALAWI_COUNTRY_CODE}${national}`,
    display: formatMalawiDisplay(national),
    isInternational: false,
  };
}

export function normalizePhoneInput(input: string): PhoneNormalizationResult {
  const cleaned = input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^tel:\s*/i, "");

  if (!cleaned) return invalid("EMPTY");
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(cleaned)) {
    return invalid("SPREADSHEET_DAMAGED");
  }
  if (!/^[+0-9\s().,-]+$/.test(cleaned)) {
    return invalid("INVALID_CHARACTERS");
  }

  const compact = cleaned.replace(/[\s().,-]/g, "");
  const explicitInternational =
    compact.startsWith("+") || compact.startsWith("00");
  let digits = compact.startsWith("+")
    ? compact.slice(1)
    : compact.startsWith("00")
      ? compact.slice(2)
      : compact;

  if (!/^\d+$/.test(digits)) return invalid("INVALID_CHARACTERS");

  if (explicitInternational && !digits.startsWith(MALAWI_COUNTRY_CODE)) {
    if (digits.length < 8) return invalid("TOO_SHORT");
    if (digits.length > 15) return invalid("TOO_LONG");
    return {
      ok: true,
      canonical: digits,
      display: `+${digits}`,
      isInternational: true,
      ...(digits.startsWith("27")
        ? { whatsappUrl: `https://wa.me/${digits}` }
        : {}),
    };
  }

  if (digits.startsWith(MALAWI_COUNTRY_CODE)) {
    digits = digits.slice(MALAWI_COUNTRY_CODE.length);
    if (digits.startsWith(MALAWI_COUNTRY_CODE)) return invalid("NOT_MOBILE");
    if (digits.startsWith("0")) digits = digits.slice(1);
    return normalizeMalawiNational(digits);
  }

  if (digits.startsWith("0")) {
    if (!/^0[89]/.test(digits)) return invalid("NOT_MOBILE");
    return normalizeMalawiNational(digits.slice(1));
  }

  return normalizeMalawiNational(digits);
}

export type PhoneListEntry = Readonly<{
  input: string;
  result: PhoneNormalizationResult;
}>;

export function parsePhoneList(input: string): readonly PhoneListEntry[] {
  return input
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({ input: value, result: normalizePhoneInput(value) }));
}
