import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { HEX64_REGEX } from '@/shared/crypto/hash-formats.js';
import { users } from './users.js';

export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('email_verification_tokens_token_hash_unique').on(table.tokenHash),
    check(
      'email_verification_tokens_token_hash_format_check',
      sql`${table.tokenHash} ~ ${sql.raw(`'${HEX64_REGEX.source}'`)}`
    )
  ]
);
