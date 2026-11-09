import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  encodeBase64Url,
  formatPasswordHash,
  hashFingerprint,
  hashIp,
  hashToken,
  hmacHex,
  normalizePhoneInput,
  normalizeTokenInput,
  parsePasswordHash,
  sha256Hex,
} from "./shared";

type PhoneVector = Readonly<{
  input: string;
  expected: ReturnType<typeof normalizePhoneInput>;
}>;

type TokenVector = Readonly<{
  input: string;
  expected: ReturnType<typeof normalizeTokenInput>;
}>;

type HashVectors = Readonly<{
  sha256Hex: readonly { input: string; expected: string }[];
  hmacHex: readonly {
    secret: string;
    message: string;
    expected: string;
  }[];
  hashToken: readonly {
    secret: string;
    stationId: string;
    normalizedToken: string;
    expected: string;
  }[];
  hashIp: readonly { secret: string; ip: string; expected: string }[];
  hashFingerprint: readonly {
    secret: string;
    fingerprint: string;
    expected: string;
  }[];
  base64url: readonly {
    bytes: number[];
    encoded: string;
    decoded: number[];
  }[];
  passwordHash: {
    parts: {
      algorithm: "pbkdf2-sha256";
      iterations: number;
      salt: string;
      hash: string;
    };
    formatted: string;
    parsed: { ok: true; value: HashVectors["passwordHash"]["parts"] };
    invalid: {
      text: string;
      expected: { ok: false; reason: "INVALID_FORMAT" };
    };
  };
}>;

async function readVector<T>(name: string): Promise<T> {
  const contents = await readFile(
    resolve(process.cwd(), "docs/test-vectors", name),
    "utf8",
  );
  return JSON.parse(contents) as T;
}

describe("shared utility contract vectors", () => {
  let phoneVectors: readonly PhoneVector[];
  let tokenVectors: readonly TokenVector[];
  let hashVectors: HashVectors;

  beforeAll(async () => {
    [phoneVectors, tokenVectors, hashVectors] = await Promise.all([
      readVector<readonly PhoneVector[]>("phone-normalizer.json"),
      readVector<readonly TokenVector[]>("token-normalizer.json"),
      readVector<HashVectors>("hash-formats.json"),
    ]);
  });

  it("passes every phone normalization vector", async () => {
    for (const vector of phoneVectors) {
      expect(normalizePhoneInput(vector.input), vector.input).toEqual(
        vector.expected,
      );
    }
  });

  it("passes every token normalization vector", async () => {
    for (const vector of tokenVectors) {
      expect(normalizeTokenInput(vector.input), vector.input).toEqual(
        vector.expected,
      );
    }
  });

  it("passes every cryptographic format vector", async () => {
    for (const vector of hashVectors.sha256Hex) {
      expect(await sha256Hex(vector.input)).toBe(vector.expected);
    }
    for (const vector of hashVectors.hmacHex) {
      expect(await hmacHex(vector.secret, vector.message)).toBe(
        vector.expected,
      );
    }
    for (const vector of hashVectors.hashToken) {
      expect(
        await hashToken(
          vector.secret,
          vector.stationId,
          vector.normalizedToken,
        ),
      ).toBe(vector.expected);
    }
    for (const vector of hashVectors.hashIp) {
      expect(await hashIp(vector.secret, vector.ip)).toBe(vector.expected);
    }
    for (const vector of hashVectors.hashFingerprint) {
      expect(await hashFingerprint(vector.secret, vector.fingerprint)).toBe(
        vector.expected,
      );
    }
    for (const vector of hashVectors.base64url) {
      const bytes = Uint8Array.from(vector.bytes);
      expect(encodeBase64Url(bytes)).toBe(vector.encoded);
      expect([...decodeBase64Url(vector.encoded)]).toEqual(vector.decoded);
    }

    expect(formatPasswordHash(hashVectors.passwordHash.parts)).toBe(
      hashVectors.passwordHash.formatted,
    );
    expect(parsePasswordHash(hashVectors.passwordHash.formatted)).toEqual(
      hashVectors.passwordHash.parsed,
    );
    expect(parsePasswordHash(hashVectors.passwordHash.invalid.text)).toEqual(
      hashVectors.passwordHash.invalid.expected,
    );
  });
});
