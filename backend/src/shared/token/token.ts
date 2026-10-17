import { VOTER_TOKEN } from '../constants.js';
import type { TokenNormalizationResult } from '../schemas.js';

const tokenAlphabetPattern = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+$/u;
const textEncoder = new TextEncoder();

export function generateVoterToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(VOTER_TOKEN.payloadLength));
  const token = Array.from(randomBytes, (byte) => VOTER_TOKEN.alphabet[byte & 31]).join('');
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
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(`${stationId}:${normalizedToken}`)
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const comparisonLength = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < comparisonLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
