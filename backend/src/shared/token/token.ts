import { VOTER_TOKEN } from '../constants.js';
import { hmacHex } from '../crypto/crypto.js';
import { randomBytes } from '../crypto/encoding.js';
import type { TokenNormalizationResult } from '../schemas.js';

const tokenAlphabetPattern = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/u;

export function generateVoterToken(): string {
  const bytes = randomBytes(VOTER_TOKEN.payloadLength);
  const token = Array.from(bytes, (byte) => VOTER_TOKEN.alphabet[byte & 31]).join('');
  const groups = token.match(/.{4}/gu);
  if (!groups || groups.length !== 3) {
    throw new Error('Failed to format voter token');
  }
  return `${VOTER_TOKEN.prefix}-${groups.join('-')}`;
}

export function normalizeTokenInput(input: string): TokenNormalizationResult {
  let normalized = input.toUpperCase().replace(/[\s-]/gu, '');
  if (
    normalized.startsWith(VOTER_TOKEN.prefix) &&
    normalized.length === VOTER_TOKEN.payloadLength + 2
  ) {
    normalized = normalized.slice(VOTER_TOKEN.prefix.length);
  }
  normalized = normalized.replace(/[O]/gu, '0').replace(/[IL]/gu, '1');

  if (normalized.length !== VOTER_TOKEN.payloadLength) {
    return { ok: false, reason: 'INVALID_LENGTH' };
  }
  if (!tokenAlphabetPattern.test(normalized)) {
    return { ok: false, reason: 'INVALID_CHARACTERS' };
  }
  return { ok: true, normalized };
}

export async function hashToken(
  secret: string,
  stationId: string,
  normalizedToken: string
): Promise<string> {
  return hmacHex(secret, `${stationId}:${normalizedToken}`);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const comparisonLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < comparisonLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
