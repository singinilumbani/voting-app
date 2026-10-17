import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { activityEventEnum } from './enums.js';
import { pollingStations } from './polling-stations.js';
import { users } from './users.js';

export const activityLog = pgTable('activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollingStationId: uuid('polling_station_id')
    .notNull()
    .references(() => pollingStations.id),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  eventType: activityEventEnum('event_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});
