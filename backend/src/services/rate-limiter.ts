import { hmacHex } from '../shared/crypto/crypto.js';
import type { RateLimitCounterRepository } from './rate-limit.repository.js';

export interface RateLimiter {
  consume(key: string, now?: number): boolean | Promise<boolean>;
}

export interface CloudflareRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maxEntries = 10_000
  ) {
    validatePolicy(limit, windowMs);
  }

  consume(key: string, now = Date.now()): boolean {
    const current = this.attempts.get(key);
    if (current && current.expiresAt > now) {
      if (current.count >= this.limit) {
        return false;
      }
      current.count += 1;
      return true;
    }

    if (this.attempts.size >= this.maxEntries) {
      for (const [entryKey, entry] of this.attempts) {
        if (entry.expiresAt <= now) {
          this.attempts.delete(entryKey);
        }
      }
      if (this.attempts.size >= this.maxEntries) {
        const oldestKey = this.attempts.keys().next().value as string | undefined;
        if (oldestKey) {
          this.attempts.delete(oldestKey);
        }
      }
    }

    this.attempts.set(key, { count: 1, expiresAt: now + this.windowMs });
    return true;
  }
}

export class DatabaseRateLimiter implements RateLimiter {
  constructor(
    private readonly repository: RateLimitCounterRepository,
    private readonly secret: string,
    private readonly limit: number,
    private readonly windowMs: number
  ) {
    validatePolicy(limit, windowMs);
  }

  async consume(key: string, now = Date.now()): Promise<boolean> {
    const keyHash = await hmacHex(this.secret, key);
    const timestamp = new Date(now);
    const expiresAt = new Date(now + this.windowMs);
    await this.repository.deleteExpired(timestamp, 100);
    const count = await this.repository.incrementWithinWindow(keyHash, timestamp, expiresAt);
    return count <= this.limit;
  }
}

export class CloudflareRateLimiter implements RateLimiter {
  constructor(
    private readonly binding: CloudflareRateLimitBinding,
    private readonly secret: string,
    private readonly namespace: string
  ) {}

  async consume(key: string): Promise<boolean> {
    const keyHash = await hmacHex(this.secret, `${this.namespace}:${key}`);
    const result = await this.binding.limit({ key: keyHash });
    return result.success;
  }
}

function validatePolicy(limit: number, windowMs: number): void {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1
  ) {
    throw new RangeError('Rate limit and window must be positive safe integers');
  }
}
