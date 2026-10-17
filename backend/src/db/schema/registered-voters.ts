import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { approvalStatusEnum } from './enums.js';
import { pollingStations } from './polling-stations.js';
import { HEX64_REGEX } from '@/shared/crypto/hash-formats.js';

// One ballot per voter is enforced by locking this row before checking/updating has_voted; voter_id is not a separate column.
export const registeredVoters = pgTable(
  'registered_voters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id),
    fullName: varchar('full_name', { length: 200 }).notNull(),
    phoneNumber: varchar('phone_number', { length: 32 }).notNull(),
    approvalStatus: approvalStatusEnum('approval_status').notNull().default('PENDING'),
    rejectionReason: text('rejection_reason'),
    registrationAttempts: integer('registration_attempts').notNull().default(0),
    blocked: boolean('blocked').notNull().default(false),
    tokenHash: text('token_hash'),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
    deviceFingerprintHash: text('device_fingerprint_hash'),
    clientDeviceUuid: uuid('client_device_uuid'),
    ipHash: text('ip_hash'),
    flagReason: text('flag_reason'),
    hasVoted: boolean('has_voted').notNull().default(false),
    votedAt: timestamp('voted_at', { withTimezone: true, mode: 'date' }),
    registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    uniqueIndex('registered_voters_station_phone_unique').on(
      table.pollingStationId,
      table.phoneNumber
    ),
    index('registered_voters_station_token_hash_idx').on(table.pollingStationId, table.tokenHash),
    index('registered_voters_station_approval_status_idx').on(
      table.pollingStationId,
      table.approvalStatus
    ),
    check(
      'registered_voters_token_hash_format_check',
      sql`${table.tokenHash} IS NULL OR ${table.tokenHash} ~ ${sql.raw(`'${HEX64_REGEX.source}'`)}`
    ),
    check(
      'registered_voters_ip_hash_format_check',
      sql`${table.ipHash} IS NULL OR ${table.ipHash} ~ ${sql.raw(`'${HEX64_REGEX.source}'`)}`
    ),
    check(
      'registered_voters_device_fingerprint_hash_format_check',
      sql`${table.deviceFingerprintHash} IS NULL OR ${table.deviceFingerprintHash} ~ ${sql.raw(`'${HEX64_REGEX.source}'`)}`
    ),
    check(
      'registered_voters_voted_at_minute_precision_check',
      sql`${table.votedAt} IS NULL OR EXTRACT(SECOND FROM ${table.votedAt}) = 0`
    )
  ]
);
