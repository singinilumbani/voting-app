import { boolean, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pollingStations } from './polling-stations.js';

export const deviceRecords = pgTable(
  'device_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id),
    clientDeviceUuid: uuid('client_device_uuid').notNull(),
    deviceFingerprintHash: varchar('device_fingerprint_hash', { length: 128 }),
    hasVoted: boolean('has_voted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('device_records_station_client_uuid_unique').on(
      table.pollingStationId,
      table.clientDeviceUuid
    )
  ]
);
