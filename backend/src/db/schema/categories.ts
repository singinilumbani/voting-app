import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pollingStations } from './polling-stations.js';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollingStationId: uuid('polling_station_id')
    .notNull()
    .references(() => pollingStations.id),
  title: varchar('title', { length: 200 }).notNull(),
  displayOrder: integer('display_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});
