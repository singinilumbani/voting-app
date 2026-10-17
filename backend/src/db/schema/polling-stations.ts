import {
  boolean,
  check,
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
    check('polling_stations_voter_cap_check', sql`${table.voterCap} BETWEEN 2 AND 50000`)
  ]
);
