import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountTypeEnum, planEnum } from './enums.js';
import { PASSWORD_HASH_REGEX } from '@/shared/crypto/hash-formats.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 80 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    accountType: accountTypeEnum('account_type').notNull(),
    plan: planEnum('plan').notNull().default('FREE'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    purgeAt: timestamp('purge_at', { withTimezone: true, mode: 'date' }),
    inactivityWarningSentAt: timestamp('inactivity_warning_sent_at', {
      withTimezone: true,
      mode: 'date'
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('users_username_unique').on(table.username),
    uniqueIndex('users_email_unique').on(table.email),
    check(
      'users_password_hash_format_check',
      sql`${table.passwordHash} ~ ${sql.raw(`'${PASSWORD_HASH_REGEX.source}'`)}`
    )
  ]
);
