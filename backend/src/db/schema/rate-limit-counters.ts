import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const rateLimitCounters = pgTable(
  'rate_limit_counters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    keyHash: text('key_hash').notNull().unique(),
    count: integer('count').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [index('rate_limit_counters_expires_at_idx').on(table.expiresAt)]
);
