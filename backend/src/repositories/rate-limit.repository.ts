import { and, inArray, lte, sql } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient } from '../db/client.js';
import { rateLimitCounters } from '../db/schema/rate-limit-counters.js';
import type { RateLimitCounterRepository } from '../services/rate-limit.repository.js';

export class RateLimitRepository extends BaseRepository implements RateLimitCounterRepository {
  private constructor(db: DbClient['db']) {
    super(db);
  }

  static fromClient(client: DbClient): RateLimitRepository {
    return new RateLimitRepository(client.db);
  }

  async incrementWithinWindow(keyHash: string, now: Date, expiresAt: Date): Promise<number> {
    const [record] = await this.db
      .insert(rateLimitCounters)
      .values({ keyHash, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitCounters.keyHash,
        set: {
          count: sql`CASE WHEN ${rateLimitCounters.expiresAt} <= ${now} THEN 1 ELSE ${rateLimitCounters.count} + 1 END`,
          expiresAt: sql`CASE WHEN ${rateLimitCounters.expiresAt} <= ${now} THEN ${expiresAt} ELSE ${rateLimitCounters.expiresAt} END`
        }
      })
      .returning({ count: rateLimitCounters.count });

    return record?.count ?? 0;
  }

  async deleteExpired(now: Date, limit: number): Promise<number> {
    const expired = this.db
      .select({ id: rateLimitCounters.id })
      .from(rateLimitCounters)
      .where(lte(rateLimitCounters.expiresAt, now))
      .limit(limit);

    const deleted = await this.db
      .delete(rateLimitCounters)
      .where(and(inArray(rateLimitCounters.id, expired), lte(rateLimitCounters.expiresAt, now)))
      .returning({ id: rateLimitCounters.id });

    return deleted.length;
  }
}
