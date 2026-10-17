import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HEX64_FORMAT_SAMPLES,
  HEX64_REGEX,
  PASSWORD_HASH_FORMAT_SAMPLES,
  PASSWORD_HASH_REGEX
} from '@/shared/crypto/hash-formats.js';
import type { DbClient } from './client.js';
import { createTestDatabase, truncateTestDatabase } from './test-helpers.js';
import { deviceRecords } from './schema/device-records.js';
import { passwordResetTokens } from './schema/password-reset-tokens.js';
import { pollingStations } from './schema/polling-stations.js';
import { registeredVoters } from './schema/registered-voters.js';
import { sessions } from './schema/sessions.js';
import { users } from './schema/users.js';

const validPasswordHash = 'pbkdf2-sha256$600000$MDEyMzQ1Njc4OWFiY2RlZg$MDEyMzQ1Njc4OWFiY2RlZg';

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
    expect(columns.map((column) => column.column_name).sort()).toEqual([
      'candidate_id',
      'category_id',
      'id',
      'polling_station_id'
    ]);
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

  it('keeps voter identity in the primary-key row and has only the required indexes', async () => {
    const columns = await client.db.execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'registered_voters'
    `);
    expect(columns.rows.map((column) => column.column_name)).not.toContain('voter_id');

    const indexes = await client.db.execute<{ indexname: string; indexdef: string }>(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'registered_voters'
    `);
    expect(indexes.rows.map((index) => index.indexname).sort()).toEqual([
      'registered_voters_pkey',
      'registered_voters_station_approval_status_idx',
      'registered_voters_station_phone_unique',
      'registered_voters_station_token_hash_idx'
    ]);
    expect(indexes.rows.map((index) => index.indexdef).join('\n')).toContain(
      '(polling_station_id, phone_number)'
    );
    expect(indexes.rows.map((index) => index.indexdef).join('\n')).not.toMatch(
      /UNIQUE.*polling_station_id.*voter_id/iu
    );
  });

  it('enforces phone uniqueness per station', async () => {
    const host = await createHost();
    const stationA = await createStation(host.id, 'Station A');
    const stationB = await createStation(host.id, 'Station B');
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

  it('accepts valid hash formats and rejects malformed stored hashes', async () => {
    const host = await createHost();
    const station = await createStation(host.id, 'Hash format station');
    const hexHash = 'a'.repeat(64);

    await expect(
      client.db.insert(users).values({
        username: 'bad-hash-host',
        email: 'bad-hash-host@example.test',
        passwordHash: 'not-a-valid-hash',
        accountType: 'LONG_TERM'
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    await expect(
      client.db.insert(registeredVoters).values({
        pollingStationId: station.id,
        fullName: 'Invalid token hash',
        phoneNumber: '265991000001',
        tokenHash: 'g'.repeat(64),
        ipHash: hexHash,
        deviceFingerprintHash: hexHash
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db.insert(registeredVoters).values({
        pollingStationId: station.id,
        fullName: 'Invalid IP hash',
        phoneNumber: '265991000002',
        tokenHash: hexHash,
        ipHash: 'A'.repeat(64),
        deviceFingerprintHash: hexHash
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db.insert(registeredVoters).values({
        pollingStationId: station.id,
        fullName: 'Invalid fingerprint hash',
        phoneNumber: '265991000003',
        tokenHash: hexHash,
        ipHash: hexHash,
        deviceFingerprintHash: 'short'
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db.insert(deviceRecords).values({
        pollingStationId: station.id,
        clientDeviceUuid: '2e4a9aaf-4ad5-47e7-a6b3-019268bcbced',
        deviceFingerprintHash: 'short'
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db.insert(sessions).values({
        userId: host.id,
        tokenHash: 'invalid',
        expiresAt: new Date('2030-01-01T00:00:00Z')
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      client.db.insert(passwordResetTokens).values({
        userId: host.id,
        tokenHash: 'invalid',
        expiresAt: new Date('2030-01-01T00:00:00Z')
      })
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    await expect(
      client.db.insert(users).values({
        username: 'valid-hash-host',
        email: 'valid-hash-host@example.test',
        passwordHash: validPasswordHash,
        accountType: 'LONG_TERM'
      })
    ).resolves.toBeDefined();
    await expect(
      client.db.insert(registeredVoters).values({
        pollingStationId: station.id,
        fullName: 'Valid hashes',
        phoneNumber: '265991000004',
        tokenHash: hexHash,
        ipHash: hexHash,
        deviceFingerprintHash: hexHash
      })
    ).resolves.toBeDefined();
    await expect(
      client.db.insert(deviceRecords).values({
        pollingStationId: station.id,
        clientDeviceUuid: '417c775d-11ef-4d46-a8d1-09f76a0abf59',
        deviceFingerprintHash: hexHash
      })
    ).resolves.toBeDefined();
    await expect(
      client.db.insert(sessions).values({
        userId: host.id,
        tokenHash: hexHash,
        expiresAt: new Date('2030-01-01T00:00:00Z')
      })
    ).resolves.toBeDefined();
    await expect(
      client.db.insert(passwordResetTokens).values({
        userId: host.id,
        tokenHash: hexHash,
        expiresAt: new Date('2030-01-01T00:00:00Z')
      })
    ).resolves.toBeDefined();
  });

  it('checks database regexes against the shared valid and invalid samples', async () => {
    const regexSamples = [
      { regex: HEX64_REGEX, samples: HEX64_FORMAT_SAMPLES },
      { regex: PASSWORD_HASH_REGEX, samples: PASSWORD_HASH_FORMAT_SAMPLES }
    ];

    for (const { regex, samples } of regexSamples) {
      for (const value of samples.valid) {
        const result = await client.db.execute<{ matches: boolean }>(
          sql`SELECT ${value} ~ ${sql.raw(`'${regex.source}'`)} AS matches`
        );
        expect(result.rows[0]?.matches).toBe(true);
      }
      for (const value of samples.invalid) {
        const result = await client.db.execute<{ matches: boolean }>(
          sql`SELECT ${value} ~ ${sql.raw(`'${regex.source}'`)} AS matches`
        );
        expect(result.rows[0]?.matches).toBe(false);
      }
    }
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
        passwordHash: validPasswordHash,
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
    if (!station) {
      throw new Error('Failed to create constraint test station');
    }
    return station;
  }
});
