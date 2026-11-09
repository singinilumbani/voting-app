import { PASSWORD_HASH_ALGORITHM } from "./constants";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return toHex(new Uint8Array(digest));
}

export async function hmacHex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toHex(new Uint8Array(signature));
}

export function hashToken(
  secret: string,
  stationId: string,
  normalizedToken: string,
): Promise<string> {
  return hmacHex(secret, `${stationId}:${normalizedToken}`);
}

export function hashIp(secret: string, ip: string): Promise<string> {
  return hmacHex(secret, `ip:${ip}`);
}

export function hashFingerprint(
  secret: string,
  fingerprint: string,
): Promise<string> {
  return hmacHex(secret, `fp:${fingerprint}`);
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export type PasswordHashParts = Readonly<{
  algorithm: typeof PASSWORD_HASH_ALGORITHM;
  iterations: number;
  salt: string;
  hash: string;
}>;

export function formatPasswordHash(parts: PasswordHashParts): string {
  return `${parts.algorithm}$${parts.iterations}$${parts.salt}$${parts.hash}`;
}

export type PasswordHashParseResult =
  | Readonly<{ ok: true; value: PasswordHashParts }>
  | Readonly<{ ok: false; reason: "INVALID_FORMAT" }>;

export function parsePasswordHash(value: string): PasswordHashParseResult {
  const [algorithm, iterationsText, salt, hash, extra] = value.split("$");
  const iterations = Number(iterationsText);
  if (
    extra !== undefined ||
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    !/^[1-9]\d*$/.test(iterationsText ?? "") ||
    !Number.isSafeInteger(iterations) ||
    !salt ||
    !hash
  ) {
    return { ok: false, reason: "INVALID_FORMAT" };
  }
  return {
    ok: true,
    value: {
      algorithm: PASSWORD_HASH_ALGORITHM,
      iterations,
      salt,
      hash,
    },
  };
}
