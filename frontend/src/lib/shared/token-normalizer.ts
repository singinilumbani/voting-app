import { TOKEN_ALPHABET, TOKEN_LENGTH, TOKEN_PREFIX } from "./constants";

export type TokenNormalizationResult =
  | Readonly<{ ok: true; normalized: string }>
  | Readonly<{
      ok: false;
      reason: "INVALID_LENGTH" | "INVALID_CHARACTERS";
    }>;

function compactToken(input: string): string {
  const explicitPrefix = /^TK-/i.test(input.trim());
  let compact = input.toUpperCase().replace(/[\s-]/g, "");

  if (explicitPrefix) compact = compact.slice(TOKEN_PREFIX.length);
  else if (
    compact.startsWith(TOKEN_PREFIX) &&
    compact.length === TOKEN_LENGTH + 2
  ) {
    compact = compact.slice(TOKEN_PREFIX.length);
  }

  return compact.replace(/[O]/g, "0").replace(/[IL]/g, "1");
}

export function normalizeTokenInput(input: string): TokenNormalizationResult {
  const normalized = compactToken(input);

  if (
    [...normalized].some((character) => !TOKEN_ALPHABET.includes(character))
  ) {
    return { ok: false, reason: "INVALID_CHARACTERS" };
  }
  if (normalized.length !== TOKEN_LENGTH) {
    return { ok: false, reason: "INVALID_LENGTH" };
  }

  return { ok: true, normalized };
}

export function formatTokenInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const explicitPrefix = /^TK-/i.test(trimmed);
  let compact = trimmed.toUpperCase().replace(/[\s-]/g, "");

  if (explicitPrefix) compact = compact.slice(TOKEN_PREFIX.length);
  else if (compact.startsWith(TOKEN_PREFIX) && compact.length > TOKEN_LENGTH) {
    compact = compact.slice(TOKEN_PREFIX.length);
  }

  compact = compact
    .replace(/[O]/g, "0")
    .replace(/[IL]/g, "1")
    .slice(0, TOKEN_LENGTH);
  const groups = compact.match(/.{1,4}/g) ?? [];
  return groups.length > 0
    ? `${TOKEN_PREFIX}-${groups.join("-")}`
    : `${TOKEN_PREFIX}-`;
}

export function generateVoterToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  const body = [...bytes].map((byte) => TOKEN_ALPHABET[byte & 31]).join("");
  return `${TOKEN_PREFIX}-${body.match(/.{4}/g)?.join("-") ?? body}`;
}
