import { timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountTypeEnum, planEnum } from './enums.js';
import { pgTable, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 80 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    accountType: accountTypeEnum('account_type').notNull(),
    plan: planEnum('plan').notNull().default('FREE'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    purgeAt: timestamp('purge_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('users_username_unique').on(table.username),
    uniqueIndex('users_email_unique').on(table.email)
  ]
);
