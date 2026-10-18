import { describe, expect, it } from 'vitest';
import { CloudflareRateLimiter, DatabaseRateLimiter } from './rate-limiter.js';
import type { RateLimitCounterRepository } from './rate-limit.repository.js';

describe('DatabaseRateLimiter', () => {
  it('counts attempts atomically within a fixed window and resets after expiry', async () => {
    const repository = new MemoryRateLimitRepository();
    const limiter = new DatabaseRateLimiter(repository, 'secret'.repeat(6), 2, 60_000);

    expect(await limiter.consume('registration:phone:hash', 1_000)).toBe(true);
    expect(await limiter.consume('registration:phone:hash', 2_000)).toBe(true);
    expect(await limiter.consume('registration:phone:hash', 3_000)).toBe(false);
    expect(await limiter.consume('registration:phone:hash', 61_000)).toBe(true);
    expect(repository.keys()).toHaveLength(1);
    expect(repository.keys()[0]).not.toContain('registration:phone:hash');
  });

  it('stores only a one-way hash of the rate-limit key', async () => {
    let recordedHash = '';
    const repository: RateLimitCounterRepository = {
      async incrementWithinWindow(keyHash) {
        recordedHash = keyHash;
        return 1;
      },
      async deleteExpired() {
        return 0;
      }
    };
    const limiter = new DatabaseRateLimiter(repository, 'secret'.repeat(6), 10, 60_000);

    await limiter.consume('login:username:private@example.test', 1_000);

    expect(recordedHash).not.toContain('private@example.test');
    expect(recordedHash).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe('CloudflareRateLimiter', () => {
  it('uses a hashed, namespaced key and honors the Worker binding result', async () => {
    let submittedKey = '';
    const limiter = new CloudflareRateLimiter(
      {
        async limit({ key }) {
          submittedKey = key;
          return { success: false };
        }
      },
      'secret'.repeat(6),
      'forgot-password'
    );

    expect(await limiter.consume('email:person@example.test')).toBe(false);
    expect(submittedKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(submittedKey).not.toContain('person@example.test');
  });
});

class MemoryRateLimitRepository implements RateLimitCounterRepository {
  private readonly records = new Map<string, { count: number; expiresAt: number }>();

  async incrementWithinWindow(keyHash: string, now: Date, expiresAt: Date): Promise<number> {
    const previous = this.records.get(keyHash);
    if (!previous || previous.expiresAt <= now.getTime()) {
      this.records.set(keyHash, { count: 1, expiresAt: expiresAt.getTime() });
      return 1;
    }
    previous.count += 1;
    return previous.count;
  }

  async deleteExpired(now: Date): Promise<number> {
    let deleted = 0;
    for (const [key, record] of this.records) {
      if (record.expiresAt <= now.getTime()) {
        this.records.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  keys(): string[] {
    return [...this.records.keys()];
  }
}
