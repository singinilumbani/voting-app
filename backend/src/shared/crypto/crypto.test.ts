import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  base64urlDecode,
  base64urlEncode,
  formatPasswordHash,
  hashFingerprint,
  hashIp,
  HEX64_FORMAT_SAMPLES,
  HEX64_REGEX,
  hmacHex,
  isHex64,
  isPasswordHash,
  parsePasswordHash,
  PASSWORD_HASH_FORMAT_SAMPLES,
  PASSWORD_HASH_REGEX,
  randomBytes,
  sha256Hex
} from './index.js';
import { hashToken } from '../token/token.js';

const vectors = JSON.parse(
  readFileSync(new URL('../../../docs/test-vectors/hash-formats.json', import.meta.url), 'utf8')
) as {
  sha256Hex: Array<{ input: string; expected: string }>;
  hmacHex: Array<{ secret: string; message: string; expected: string }>;
  hashToken: Array<{
    secret: string;
    stationId: string;
    normalizedToken: string;
    expected: string;
  }>;
  hashIp: Array<{ secret: string; ip: string; expected: string }>;
  hashFingerprint: Array<{ secret: string; fingerprint: string; expected: string }>;
  base64url: Array<{ bytes: number[]; encoded: string; decoded: number[] }>;
  passwordHash: {
    parts: { algorithm: string; iterations: number; salt: string; hash: string };
    formatted: string;
    parsed: {
      ok: true;
      value: { algorithm: string; iterations: number; salt: string; hash: string };
    };
    invalid: { text: string; expected: { ok: false; reason: string } };
  };
};

describe('shared crypto known-answer vectors', () => {
  it.each(vectors.sha256Hex)('hashes SHA-256 input $input', async ({ input, expected }) => {
    expect(await sha256Hex(input)).toBe(expected);
  });

  it.each(vectors.hmacHex)(
    'hashes HMAC message $message',
    async ({ secret, message, expected }) => {
      expect(await hmacHex(secret, message)).toBe(expected);
    }
  );

  it.each(vectors.hashToken)(
    'hashes station-scoped token $normalizedToken',
    async ({ secret, stationId, normalizedToken, expected }) => {
      expect(await hashToken(secret, stationId, normalizedToken)).toBe(expected);
    }
  );

  it.each(vectors.hashIp)('hashes IP $ip', async ({ secret, ip, expected }) => {
    expect(await hashIp(secret, ip)).toBe(expected);
  });

  it.each(vectors.hashFingerprint)(
    'hashes fingerprint $fingerprint',
    async ({ secret, fingerprint, expected }) => {
      expect(await hashFingerprint(secret, fingerprint)).toBe(expected);
    }
  );

  it.each(vectors.base64url)('encodes byte vector $encoded', ({ bytes, encoded, decoded }) => {
    expect(base64urlEncode(new Uint8Array(bytes))).toBe(encoded);
    expect(Array.from(base64urlDecode(encoded))).toEqual(decoded);
  });

  it('parses and formats password hashes using shared vectors', () => {
    expect(formatPasswordHash(vectors.passwordHash.parts)).toEqual({
      ok: true,
      value: vectors.passwordHash.formatted
    });
    expect(parsePasswordHash(vectors.passwordHash.formatted)).toEqual(vectors.passwordHash.parsed);
    expect(parsePasswordHash(vectors.passwordHash.invalid.text)).toEqual(
      vectors.passwordHash.invalid.expected
    );
  });

  it('rejects invalid byte lengths and invalid base64url input', () => {
    expect(() => randomBytes(-1)).toThrow(RangeError);
    expect(() => base64urlDecode('not+base64')).toThrow(TypeError);
    expect(randomBytes(0)).toHaveLength(0);
    expect(randomBytes(70_000)).toHaveLength(70_000);
  });
});

describe('database hash CHECK regex parity', () => {
  it('accepts/rejects the same samples as the database regex definitions', () => {
    for (const value of HEX64_FORMAT_SAMPLES.valid) {
      expect(HEX64_REGEX.test(value)).toBe(true);
      expect(isHex64(value)).toBe(true);
    }
    for (const value of HEX64_FORMAT_SAMPLES.invalid) {
      expect(HEX64_REGEX.test(value)).toBe(false);
      expect(isHex64(value)).toBe(false);
    }
    for (const value of PASSWORD_HASH_FORMAT_SAMPLES.valid) {
      expect(PASSWORD_HASH_REGEX.test(value)).toBe(true);
      expect(isPasswordHash(value)).toBe(true);
    }
    for (const value of PASSWORD_HASH_FORMAT_SAMPLES.invalid) {
      expect(PASSWORD_HASH_REGEX.test(value)).toBe(false);
      expect(isPasswordHash(value)).toBe(false);
    }
  });

  it('uses the same regex sources in the generated migration CHECK constraints', () => {
    const migrationPath = fileURLToPath(new URL('../../db/migrations/', import.meta.url));
    const migrations = readdirSync(migrationPath)
      .filter((file) => /^\d{4}_.+\.sql$/u.test(file))
      .sort()
      .map((file) => readFileSync(`${migrationPath}/${file}`, 'utf8'))
      .join('\n');
    if (!migrations) {
      throw new Error('No generated database migration was found');
    }

    expect(migrations).toContain(`'${HEX64_REGEX.source}'`);
    expect(migrations).toContain(`'${PASSWORD_HASH_REGEX.source}'`);
  });
});
