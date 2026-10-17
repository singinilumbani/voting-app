import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { constantTimeEqual, generateVoterToken, hashToken, normalizeTokenInput } from './token.js';

interface TokenVector {
  input: string;
  expected:
    | { ok: true; normalized: string }
    | { ok: false; reason: 'INVALID_LENGTH' | 'INVALID_CHARACTERS' };
}

const vectors = JSON.parse(
  readFileSync(new URL('../../../docs/test-vectors/token-normalizer.json', import.meta.url), 'utf8')
) as TokenVector[];

describe('normalizeTokenInput shared vectors', () => {
  it.each(vectors)('normalizes $input', ({ input, expected }) => {
    expect(normalizeTokenInput(input)).toEqual(expected);
  });
});

describe('voter tokens', () => {
  it('generates Crockford base32 token strings', () => {
    const first = generateVoterToken();
    const second = generateVoterToken();
    expect(first).toMatch(
      /^TK-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}(?:-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}){2}$/u
    );
    expect(second).toMatch(
      /^TK-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}(?:-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}){2}$/u
    );
  });

  it('hashes a station-scoped token using HMAC-SHA-256', async () => {
    const first = await hashToken('test-secret', 'station-1', 'K7QM2XD94HNP');
    const same = await hashToken('test-secret', 'station-1', 'K7QM2XD94HNP');
    const otherStation = await hashToken('test-secret', 'station-2', 'K7QM2XD94HNP');

    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).toBe(same);
    expect(first).not.toBe(otherStation);
  });

  it.each([
    ['same strings', 'abc', 'abc', true],
    ['different strings', 'abc', 'abd', false],
    ['different lengths', 'abc', 'abcd', false],
    ['empty strings', '', '', true]
  ])('constant-time compares %s', (_label, left, right, expected) => {
    expect(constantTimeEqual(left, right)).toBe(expected);
  });
});
