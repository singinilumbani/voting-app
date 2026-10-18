import { index, pgTable, uuid } from 'drizzle-orm/pg-core';
import { categories } from './categories.js';
import { candidates } from './candidates.js';
import { pollingStations } from './polling-stations.js';

export const castVotes = pgTable(
  'cast_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollingStationId: uuid('polling_station_id')
      .notNull()
      .references(() => pollingStations.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    candidateId: uuid('candidate_id').references(() => candidates.id)
  },
  (table) => [
    index('cast_votes_station_category_candidate_idx').on(
      table.pollingStationId,
      table.categoryId,
      table.candidateId
    )
  ]
);
