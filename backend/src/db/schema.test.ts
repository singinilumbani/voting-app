import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { castVotes } from './schema/cast-votes.js';

describe('cast_votes schema', () => {
  it('contains only ballot fields and has no timestamp column', () => {
    const columns = Object.values(getTableColumns(castVotes));

    expect(columns.map((column) => column.name).sort()).toEqual([
      'candidate_id',
      'category_id',
      'id',
      'polling_station_id'
    ]);
  });
});
