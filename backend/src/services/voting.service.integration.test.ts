import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { VotingRepository } from '../repositories/voting.repository.js';
import { createTestDatabase, truncateTestDatabase } from '../db/test-helpers.js';
import type { DbClient } from '../db/client.js';
import { candidates } from '../db/schema/candidates.js';
import { categories } from '../db/schema/categories.js';
import { castVotes } from '../db/schema/cast-votes.js';
import { pollingStations } from '../db/schema/polling-stations.js';
import { registeredVoters } from '../db/schema/registered-voters.js';
import { users } from '../db/schema/users.js';
import { hashToken, normalizeTokenInput } from '../shared/index.js';
import type { RateLimiter } from './rate-limiter.js';
import { VotingService } from './voting.service.js';

const tokenSecret = 'voting-service-integration-token-secret';
const sessionSecret = 'voting-service-integration-session-secret';
const allowAll: RateLimiter = { consume: () => true };
const validPasswordHash = 'pbkdf2-sha256$5000$MDEyMzQ1Njc4OWFiY2RlZg$MDEyMzQ1Njc4OWFiY2RlZg';

describe.skipIf(process.env.DATABASE_URL === undefined)('voting PostgreSQL concurrency', () => {
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

  it('commits one anonymous ballot for 20 concurrent submissions', async () => {
    const hostId = await createHost();
    const publicId = randomUUID().replaceAll('-', '');
    const [station] = await client.db
      .insert(pollingStations)
      .values({
        publicId,
        hostId,
        name: 'Concurrent Voting',
        mode: 'CLOSED_VOTE',
        status: 'VOTE_OPEN',
        voterCap: 10,
        isLaunched: true,
        voteStartsAt: new Date(Date.now() - 60_000),
        voteEndsAt: new Date(Date.now() + 60 * 60 * 1000)
      })
      .returning();
    if (!station) throw new Error('Station insert returned no row');
    const [category] = await client.db
      .insert(categories)
      .values({ pollingStationId: station.id, title: 'Mayor', displayOrder: 1 })
      .returning();
    if (!category) throw new Error('Category insert returned no row');
    const [candidate] = await client.db
      .insert(candidates)
      .values({ categoryId: category.id, name: 'Candidate A' })
      .returning();
    if (!candidate) throw new Error('Candidate insert returned no row');
    const rawToken = `TK-${randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase()}-2222-3333`;
    const normalizedToken = normalizeTokenInput(rawToken);
    if (!normalizedToken.ok) throw new Error('Generated test token is invalid');
    const tokenHash = await hashToken(tokenSecret, station.id, normalizedToken.normalized);
    const [voter] = await client.db
      .insert(registeredVoters)
      .values({
        pollingStationId: station.id,
        fullName: 'Concurrent Voter',
        phoneNumber: `26599${randomUUID().replaceAll('-', '').slice(0, 7)}`,
        approvalStatus: 'APPROVED',
        tokenHash,
        approvedAt: new Date()
      })
      .returning();
    if (!voter) throw new Error('Voter insert returned no row');

    const service = new VotingService(VotingRepository.fromClient(client), {
      config: {
        tokenHmacSecret: tokenSecret,
        sessionSecret,
        publicPollBallotCeiling: 2500
      },
      ipRateLimiter: allowAll,
      phoneRateLimiter: allowAll
    });
    const entry = await service.enter(publicId, rawToken, undefined, '192.0.2.10');
    if (entry.alreadyVoted) throw new Error('Expected active ballot session');
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        service.submitClosed(publicId, entry.ballotSession, [
          { categoryId: category.id, candidateId: candidate.id }
        ])
      )
    );

    expect(results.filter((result) => !result.alreadyVoted)).toHaveLength(1);
    const storedVotes = await client.db
      .select({ categoryId: castVotes.categoryId, candidateId: castVotes.candidateId })
      .from(castVotes)
      .where(eq(castVotes.pollingStationId, station.id));
    expect(storedVotes).toEqual([{ categoryId: category.id, candidateId: candidate.id }]);
    const [storedVoter] = await client.db
      .select({ hasVoted: registeredVoters.hasVoted, votedAt: registeredVoters.votedAt })
      .from(registeredVoters)
      .where(eq(registeredVoters.id, voter.id));
    expect(storedVoter?.hasVoted).toBe(true);
    expect(storedVoter?.votedAt?.getUTCSeconds()).toBe(0);
  });

  async function createHost(): Promise<string> {
    const id = randomUUID();
    const [host] = await client.db
      .insert(users)
      .values({
        username: `vote-test-${id.slice(0, 8)}`,
        email: `vote-test-${id}@example.test`,
        passwordHash: validPasswordHash,
        accountType: 'LONG_TERM'
      })
      .returning({ id: users.id });
    if (!host) throw new Error('Host insert returned no row');
    return host.id;
  }
});
