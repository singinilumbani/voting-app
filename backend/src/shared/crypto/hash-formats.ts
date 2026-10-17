export const HEX64_REGEX = /^[0-9a-f]{64}$/u;

export const PASSWORD_HASH_REGEX = /^[a-z0-9-]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/u;

export const HEX64_FORMAT_SAMPLES = Object.freeze({
  valid: ['0'.repeat(64), 'a'.repeat(64), '0123456789abcdef'.repeat(4)],
  invalid: ['', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]
});

export const PASSWORD_HASH_FORMAT_SAMPLES = Object.freeze({
  valid: [
    'pbkdf2-sha256$600000$MDEyMzQ1Njc4OWFiY2RlZg$MDEyMzQ1Njc4OWFiY2RlZg',
    'other-algorithm$0$A_A$-_'
  ],
  invalid: [
    '',
    'PBKDF2-SHA256$600000$MDEyMzQ1Njc4OWFiY2RlZg$MDEyMzQ1Njc4OWFiY2RlZg',
    'pbkdf2-sha256$600000$AA==$AA',
    'pbkdf2-sha256$600000$AA$'
  ]
});

export type PasswordHashParts = {
  algorithm: string;
  iterations: number;
  salt: string;
  hash: string;
};

export type PasswordHashFormatResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'INVALID_ALGORITHM' | 'INVALID_ITERATIONS' | 'INVALID_BASE64URL' };

export type PasswordHashParseResult =
  | { ok: true; value: PasswordHashParts }
  | {
      ok: false;
      reason:
        'INVALID_FORMAT' | 'UNSUPPORTED_ALGORITHM' | 'INVALID_ITERATIONS' | 'INVALID_BASE64URL';
    };

const base64urlPartPattern = /^[A-Za-z0-9_-]+$/u;

/** Formats PBKDF2 hash parts; this function does not perform password hashing. */
export function formatPasswordHash(parts: PasswordHashParts): PasswordHashFormatResult {
  if (parts.algorithm !== 'pbkdf2-sha256') {
    return { ok: false, reason: 'INVALID_ALGORITHM' };
  }
  if (!Number.isSafeInteger(parts.iterations) || parts.iterations < 1) {
    return { ok: false, reason: 'INVALID_ITERATIONS' };
  }
  if (!base64urlPartPattern.test(parts.salt) || !base64urlPartPattern.test(parts.hash)) {
    return { ok: false, reason: 'INVALID_BASE64URL' };
  }

  const value = `${parts.algorithm}$${parts.iterations}$${parts.salt}$${parts.hash}`;
  if (!PASSWORD_HASH_REGEX.test(value)) {
    return { ok: false, reason: 'INVALID_BASE64URL' };
  }
  return { ok: true, value };
}

/** Parses the persisted password-hash string without verifying or deriving a hash. */
export function parsePasswordHash(text: string): PasswordHashParseResult {
  if (!PASSWORD_HASH_REGEX.test(text)) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  const [algorithm, iterationsText, salt, hash] = text.split('$');
  if (!algorithm || !iterationsText || !salt || !hash) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }
  if (algorithm !== 'pbkdf2-sha256') {
    return { ok: false, reason: 'UNSUPPORTED_ALGORITHM' };
  }

  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    return { ok: false, reason: 'INVALID_ITERATIONS' };
  }
  if (!base64urlPartPattern.test(salt) || !base64urlPartPattern.test(hash)) {
    return { ok: false, reason: 'INVALID_BASE64URL' };
  }

  return { ok: true, value: { algorithm, iterations, salt, hash } };
}

export function isHex64(value: string): boolean {
  return HEX64_REGEX.test(value);
}

export function isPasswordHash(value: string): boolean {
  return PASSWORD_HASH_REGEX.test(value);
}
