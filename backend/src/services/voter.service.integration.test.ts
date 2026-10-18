import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RateLimiter } from './rate-limiter.js';
import { VoterRepository } from '../repositories/voter.repository.js';
import { createTestDatabase, truncateTestDatabase } from '../db/test-helpers.js';
import type { DbClient } from '../db/client.js';
import { pollingStations } from '../db/schema/polling-stations.js';
import { registeredVoters } from '../db/schema/registered-voters.js';
import { users } from '../db/schema/users.js';
import { VoterService } from './voter.service.js';

const allowAll: RateLimiter = { consume: () => true };
const tokenHmacSecret = 'voter-service-integration-secret-32-bytes';
const validPasswordHash = 'pbkdf2-sha256$5000$MDEyMzQ1Njc4OWFiY2RlZg$MDEyMzQ1Njc4OWFiY2RlZg';

describe.skipIf(process.env.DATABASE_URL === undefined)(
  'voter registration PostgreSQL concurrency',
  () => {
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

    it('allows only one concurrent registration to claim the last slot', async () => {
      const hostId = await createHost();
      const publicId = randomUUID().replaceAll('-', '');
      const [station] = await client.db
        .insert(pollingStations)
        .values({
          publicId,
          hostId,
          name: 'Concurrent Registration',
          mode: 'CLOSED_VOTE',
          status: 'REG_OPEN',
          voterCap: 2,
          isLaunched: true
        })
        .returning();
      if (!station) throw new Error('Station insert returned no row');
      await client.db.insert(registeredVoters).values({
        pollingStationId: station.id,
        fullName: 'Already approved',
        phoneNumber: '265991111111',
        approvalStatus: 'APPROVED'
      });

      const service = new VoterService(VoterRepository.fromClient(client), {
        config: { tokenHmacSecret },
        registrationRateLimiter: allowAll,
        statusRateLimiter: allowAll,
        tokenGenerator: () =>
          `TK-${randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase()}-2222-3333`
      });
      const register = (phone: string) =>
        service.register(publicId, {
          fullName: `Concurrent ${phone}`,
          phone,
          deviceUuid: randomUUID(),
          fingerprintHash: `fingerprint-${phone}`,
          ip: '192.0.2.20'
        });
      const results = await Promise.allSettled([register('0992222222'), register('0993333333')]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const stored = await client.db
        .select({ phoneNumber: registeredVoters.phoneNumber })
        .from(registeredVoters)
        .where(
          and(
            eq(registeredVoters.pollingStationId, station.id),
            eq(registeredVoters.approvalStatus, 'PENDING')
          )
        );
      expect(stored).toHaveLength(1);
    });

    async function createHost(): Promise<string> {
      const id = randomUUID();
      const [host] = await client.db
        .insert(users)
        .values({
          username: `voter-test-${id.slice(0, 8)}`,
          email: `voter-test-${id}@example.test`,
          passwordHash: validPasswordHash,
          accountType: 'LONG_TERM'
        })
        .returning({ id: users.id });
      if (!host) throw new Error('Host insert returned no row');
      return host.id;
    }
  }
);
