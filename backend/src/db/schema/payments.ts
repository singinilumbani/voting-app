import { numeric, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { paymentStatusEnum } from './enums.js';
import { users } from './users.js';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    txRef: varchar('tx_ref', { length: 128 }).notNull(),
    status: paymentStatusEnum('status').notNull().default('PENDING'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [uniqueIndex('payments_tx_ref_unique').on(table.txRef)]
);
