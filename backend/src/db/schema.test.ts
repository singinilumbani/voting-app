import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  candidates,
  castVotes,
  categories,
  deviceRecords,
  pollingStations,
  registeredVoters,
  users
} from './schema/index.js';

describe('cast_votes schema', () => {
  it('contains only ballot fields and has no timestamp column', () => {
    const columns = Object.values(getTableColumns(castVotes));

    expect(columns.map((column) => column.name).sort()).toEqual([
      'candidate_id',
      'category_id',
      'id',
      'polling_station_id'
    ]);
    expect(columns.some((column) => /voter|device/iu.test(column.name))).toBe(false);
  });

  it('has no foreign-key path from ballots to voter or device records', () => {
    const tables: Array<
      | typeof castVotes
      | typeof categories
      | typeof candidates
      | typeof pollingStations
      | typeof registeredVoters
      | typeof deviceRecords
      | typeof users
    > = [
      castVotes,
      categories,
      candidates,
      pollingStations,
      registeredVoters,
      deviceRecords,
      users
    ];
    const tablesByName = new Map<string, (typeof tables)[number]>();
    for (const table of tables) {
      tablesByName.set(getTableName(table), table);
    }
    const reachable = new Set<string>();
    const pending: (typeof tables)[number][] = [castVotes];

    while (pending.length > 0) {
      const table = pending.pop();
      if (!table) continue;
      const name = getTableName(table);
      if (reachable.has(name)) continue;
      reachable.add(name);

      for (const foreignKey of getTableConfig(table).foreignKeys) {
        const targetName = getTableName(foreignKey.reference().foreignTable);
        const target = tablesByName.get(targetName);
        if (target) pending.push(target);
      }
    }

    expect(reachable).not.toContain('registered_voters');
    expect(reachable).not.toContain('device_records');
  });
});
