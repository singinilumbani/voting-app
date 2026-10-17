import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pollingStations } from './schema/polling-stations.js';
import { registeredVoters } from './schema/registered-voters.js';
import { users } from './schema/users.js';
import { createTestDatabase, truncateTestDatabase } from './test-helpers.js';
import type { DbClient } from './client.js';

describe.skipIf(process.env.DATABASE_URL === undefined)('PostgreSQL schema constraints', () => {
  let client: DbClient;

  beforeAll(async () => {
    client = await createTestDatabase();
  });

  beforeEach(async () => {
    await truncateTestDatabase(client);
  });

  afterAll(async () => {
    await client?.close();
  });

  it('keeps cast_votes unlinked and free of timestamps', async () => {
    const result = await client.db.execute<{
      column_name: string;
      data_type: string;
    }>(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cast_votes'
    `);
    const columns = result.rows;
    const names = columns.map((column) => column.column_name).sort();

    expect(names).toEqual(['candidate_id', 'category_id', 'id', 'polling_station_id']);
    expect(columns.some((column) => column.data_type.includes('timestamp'))).toBe(false);

    const forbiddenForeignKeys = await client.db.execute<{ referenced_table: string }>(sql`
      SELECT referenced.relname AS referenced_table
      FROM pg_constraint constraint_row
      JOIN pg_class source ON source.oid = constraint_row.conrelid
      JOIN pg_class referenced ON referenced.oid = constraint_row.confrelid
      WHERE constraint_row.contype = 'f'
        AND source.relname = 'cast_votes'
        AND referenced.relname IN ('registered_voters', 'device_records')
    `);
    expect(forbiddenForeignKeys.rows).toHaveLength(0);
  });

  it('enforces unique normalized phone numbers within a station only', async () => {
    const host = await createHost();
    const [stationA, stationB] = await Promise.all([
      createStation(host.id, 'Station A'),
      createStation(host.id, 'Station B')
    ]);
    if (!stationA || !stationB) {
      throw new Error('Failed to create constraint test stations');
    }
    const voter = {
      pollingStationId: stationA.id,
      fullName: 'Test Voter',
      phoneNumber: '+265991234567'
    };
    await client.db.insert(registeredVoters).values(voter);

    await expect(client.db.insert(registeredVoters).values(voter)).rejects.toMatchObject({
      cause: { code: '23505' }
    });

    await expect(
      client.db.insert(registeredVoters).values({ ...voter, pollingStationId: stationB.id })
    ).resolves.toBeDefined();
  });

  it('rejects voter caps outside 2 through 50000', async () => {
    const host = await createHost();
    const values = {
      hostId: host.id,
      publicId: 'voter-cap-test',
      name: 'Cap constraint test',
      mode: 'CLOSED_VOTE' as const
    };

    await expect(
      client.db.insert(pollingStations).values({ ...values, voterCap: 1 })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db
        .insert(pollingStations)
        .values({ ...values, publicId: 'voter-cap-test-high', voterCap: 50001 })
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    await expect(
      client.db.insert(pollingStations).values({ ...values, voterCap: 2 })
    ).resolves.toBeDefined();
    await expect(
      client.db
        .insert(pollingStations)
        .values({ ...values, publicId: 'voter-cap-test-max', voterCap: 50000 })
    ).resolves.toBeDefined();
  });

  async function createHost() {
    const [host] = await client.db
      .insert(users)
      .values({
        username: 'constraint-test-host',
        passwordHash: 'test-hash-not-a-credential',
        email: 'constraint-test@example.test',
        accountType: 'LONG_TERM'
      })
      .returning();
    if (!host) {
      throw new Error('Failed to create constraint test host');
    }
    return host;
  }

  async function createStation(hostId: string, name: string) {
    const [station] = await client.db
      .insert(pollingStations)
      .values({
        hostId,
        publicId: name.toLowerCase().replaceAll(' ', '-'),
        name,
        mode: 'CLOSED_VOTE',
        voterCap: 500
      })
      .returning();
    return station;
  }
});
