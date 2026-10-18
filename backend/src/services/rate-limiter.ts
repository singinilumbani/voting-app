export interface RateLimiter {
  consume(key: string, now?: number): boolean;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly maxEntries = 10_000
  ) {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(windowMs) ||
      windowMs < 1
    ) {
      throw new RangeError('Rate limit and window must be positive safe integers');
    }
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
