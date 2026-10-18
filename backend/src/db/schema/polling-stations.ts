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
import { sql } from 'drizzle-orm';
import { resultsVisibilityEnum, stationModeEnum, stationStatusEnum } from './enums.js';
import { users } from './users.js';

export const pollingStations = pgTable(
  'polling_stations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    mode: stationModeEnum('mode').notNull(),
    status: stationStatusEnum('status').notNull().default('DRAFT'),
    resultsVisibility: resultsVisibilityEnum('results_visibility').notNull().default('CONCEALED'),
    allowAbstain: boolean('allow_abstain').notNull().default(false),
    mobileOnly: boolean('mobile_only').notNull().default(false),
    voterCap: integer('voter_cap').notNull(),
    registrationDurationHours: integer('registration_duration_hours').notNull().default(12),
    votingDurationMinutes: integer('voting_duration_minutes').notNull().default(720),
    isLaunched: boolean('is_launched').notNull().default(false),
    regStartsAt: timestamp('reg_starts_at', { withTimezone: true, mode: 'date' }),
    regEndsAt: timestamp('reg_ends_at', { withTimezone: true, mode: 'date' }),
    voteStartsAt: timestamp('vote_starts_at', { withTimezone: true, mode: 'date' }),
    voteEndsAt: timestamp('vote_ends_at', { withTimezone: true, mode: 'date' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('polling_stations_public_id_unique').on(table.publicId),
    index('polling_stations_registration_end_idx')
      .on(table.regEndsAt)
      .where(sql`${table.status} = 'REG_OPEN' AND ${table.regEndsAt} IS NOT NULL`),
    index('polling_stations_vote_start_idx')
      .on(table.mode, table.status, table.voteStartsAt)
      .where(sql`${table.voteStartsAt} IS NOT NULL`),
    index('polling_stations_vote_end_idx')
      .on(table.voteEndsAt)
      .where(sql`${table.status} = 'VOTE_OPEN' AND ${table.voteEndsAt} IS NOT NULL`),
    index('polling_stations_retention_idx')
      .on(table.closedAt)
      .where(sql`${table.status} = 'VOTE_CLOSED' AND ${table.closedAt} IS NOT NULL`),
    check('polling_stations_voter_cap_check', sql`${table.voterCap} BETWEEN 2 AND 50000`)
  ]
);
