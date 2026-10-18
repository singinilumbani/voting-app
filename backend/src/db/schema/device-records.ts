import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import { pollingStations } from './polling-stations.js';
import { HEX64_REGEX } from '@/shared/crypto/hash-formats.js';

// One Public Poll ballot per device is enforced by the station-scoped unique client device identifier.
export const deviceRecords = pgTable(
  'device_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id),
    clientDeviceUuid: uuid('client_device_uuid').notNull(),
    deviceFingerprintHash: text('device_fingerprint_hash'),
    hasVoted: boolean('has_voted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('device_records_station_client_uuid_unique').on(
      table.pollingStationId,
      table.clientDeviceUuid
    ),
    index('device_records_station_fingerprint_idx')
      .on(table.pollingStationId, table.deviceFingerprintHash, table.clientDeviceUuid)
      .where(sql`${table.hasVoted} = true AND ${table.deviceFingerprintHash} IS NOT NULL`),
    check(
      'device_records_device_fingerprint_hash_format_check',
      sql`${table.deviceFingerprintHash} IS NULL OR ${table.deviceFingerprintHash} ~ ${sql.raw(`'${HEX64_REGEX.source}'`)}`
    )
  ]
);
