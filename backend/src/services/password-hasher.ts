import {
  base64urlDecode,
  base64urlEncode,
  formatPasswordHash,
  randomBytes
} from '@/shared/index.js';
import { parsePasswordHash } from '@/shared/crypto/hash-formats.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

export class Pbkdf2PasswordHasher implements PasswordHasher {
  constructor(
    private readonly iterations: number,
    private readonly saltLength = 16
  ) {
    if (!Number.isSafeInteger(iterations) || iterations < 1) {
      throw new RangeError('PBKDF2 iteration count must be a positive safe integer');
    }
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(this.saltLength);
    const digest = await derive(password, salt, this.iterations);
    const formatted = formatPasswordHash({
      algorithm: 'pbkdf2-sha256',
      iterations: this.iterations,
      salt: base64urlEncode(salt),
      hash: base64urlEncode(digest)
    });
    if (!formatted.ok) {
      throw new Error(`Could not format PBKDF2 hash: ${formatted.reason}`);
    }
    return formatted.value;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const parsed = parsePasswordHash(encodedHash);
    if (!parsed.ok) {
      return false;
    }

    const salt = base64urlDecode(parsed.value.salt);
    const expected = base64urlDecode(parsed.value.hash);
    const actual = await derive(password, salt, parsed.value.iterations);
    return constantTimeEqual(actual, expected);
  }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}
