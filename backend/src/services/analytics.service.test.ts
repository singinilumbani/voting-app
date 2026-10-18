import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { createErrorHandler } from '../core/error-handler.js';
import type { Logger } from '../core/logger.js';
import type { AuthenticatedHost } from './host-auth.service.js';
import type {
  AnalyticsCategory,
  AnalyticsCounts,
  AnalyticsRepositoryPort,
  AnalyticsVoteCount
} from './analytics.repository.js';
import { InMemoryAnalyticsSnapshotCache } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';

const stationId = '20000000-0000-4000-8000-000000000001';
const hostId = '20000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-18T12:00:00.000Z');

describe('AnalyticsService', () => {
  it('calculates Closed Vote turnout and candidate ties including abstention percentage', async () => {
    const context = createContext({
      counts: { ballotsCast: 10, approvedVoters: 20, possibleDuplicates: 0 },
      votes: [
        { categoryId: 'category-a', candidateId: 'candidate-a', count: 4 },
        { categoryId: 'category-a', candidateId: 'candidate-b', count: 4 },
        { categoryId: 'category-a', candidateId: null, count: 2 }
      ]
    });
    const snapshot = await context.service.snapshot(hostId, stationId);

    expect(snapshot.turnoutPercent).toBe(50);
    expect(snapshot.ballotsCast).toBe(10);
    expect(snapshot.approvedVoters).toBe(20);
    expect(snapshot.abstentions).toBe(2);
    expect(snapshot.categories[0]?.candidates).toMatchObject([
      { candidateId: 'candidate-a', count: 4, percentage: 40, isLeader: true, isTie: true },
      { candidateId: 'candidate-b', count: 4, percentage: 40, isLeader: true, isTie: true }
    ]);
  });

  it('marks a unique candidate leader but leaves zero-vote results without a leader', async () => {
    const context = createContext({
      counts: { ballotsCast: 3, approvedVoters: 3, possibleDuplicates: 0 },
      votes: [{ categoryId: 'category-a', candidateId: 'candidate-a', count: 3 }]
    });
    const snapshot = await context.service.snapshot(hostId, stationId);
    expect(snapshot.categories[0]?.candidates[0]).toMatchObject({
      isLeader: true,
      isTie: false,
      percentage: 100
    });

    context.repository.votes = [];
    context.cache = new InMemoryAnalyticsSnapshotCache();
    const noVotes = await new AnalyticsService(
      context.repository,
      context.cache,
      () => now
    ).snapshot(hostId, stationId);
    expect(noVotes.categories[0]?.candidates).toHaveLength(2);
    expect(
      noVotes.categories[0]?.candidates.every(
        (candidate) => candidate.count === 0 && !candidate.isLeader && !candidate.isTie
      )
    ).toBe(true);
  });

  it('returns a waiting state before voting opens and marks closed results final', async () => {
    const context = createContext({
      station: {
        status: 'REG_CLOSED',
        voteStartsAt: new Date(now.getTime() + 60_000)
      },
      counts: { ballotsCast: 0, approvedVoters: 8, possibleDuplicates: 0 }
    });
    const waiting = await context.service.snapshot(hostId, stationId);
    expect(waiting).toMatchObject({
      state: 'WAITING',
      status: 'REG_CLOSED',
      ballotsCast: 0,
      approvedVoters: 8,
      turnoutPercent: 0
    });

    context.repository.station.status = 'VOTE_CLOSED';
    context.cache = new InMemoryAnalyticsSnapshotCache();
    const final = await new AnalyticsService(context.repository, context.cache, () => now).snapshot(
      hostId,
      stationId
    );
    expect(final.state).toBe('FINAL');
  });

  it('returns Public Poll ballots and possible-duplicate count without a turnout denominator', async () => {
    const context = createContext({
      station: { mode: 'PUBLIC_POLL' },
      counts: { ballotsCast: 7, approvedVoters: null, possibleDuplicates: 2 }
    });
    const snapshot = await context.service.snapshot(hostId, stationId);
    expect(snapshot).toMatchObject({
      stationMode: 'PUBLIC_POLL',
      ballotsCast: 7,
      approvedVoters: null,
      turnoutPercent: null,
      possibleDuplicates: 2
    });
  });

  it('caches snapshots for two seconds but rechecks ownership for each request', async () => {
    let clock = now.getTime();
    const context = createContext({ now: () => new Date(clock) });
    const first = await context.service.snapshot(hostId, stationId);
    context.repository.counts = { ballotsCast: 2, approvedVoters: 4, possibleDuplicates: 0 };
    clock += 1_000;
    const cached = await context.service.snapshot(hostId, stationId);
    expect(cached.lastUpdated).toBe(first.lastUpdated);
    expect(context.repository.snapshotQueryCount).toBe(1);
    expect(context.repository.ownershipCheckCount).toBe(2);

    clock += 1_001;
    const refreshed = await context.service.snapshot(hostId, stationId);
    expect(refreshed.lastUpdated).not.toBe(first.lastUpdated);
    expect(refreshed.ballotsCast).toBe(2);
    expect(context.repository.snapshotQueryCount).toBe(2);
  });

  it('returns audit records from check-in fields without any candidate or vote information', async () => {
    const context = createContext();
    const app = express();
    const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
    app.use((_request, response, next) => {
      response.locals.analyticsService = context.service;
      response.locals.authenticatedHost = {
        host: {
          id: hostId,
          username: 'test-host',
          email: 'test@example.test',
          accountType: 'LONG_TERM',
          plan: 'FREE',
          createdAt: now,
          purgeAt: null,
          lastLoginAt: null
        },
        sessionId: 'test-session'
      } satisfies AuthenticatedHost;
      next();
    });
    app.get('/stations/:stationId/analytics/audit', new AnalyticsController().audit);
    app.use(createErrorHandler(logger));
    const response = await request(app).get(`/stations/${stationId}/analytics/audit`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      events: [
        {
          voterId: 'voter-a',
          fullName: 'Voter A',
          checkedInAt: '2026-10-18T11:59:00.000Z'
        }
      ],
      limit: 500
    });
    expect(Object.keys(response.body.events[0] as Record<string, unknown>)).toEqual([
      'voterId',
      'fullName',
      'checkedInAt'
    ]);
  });

  it('rejects a host who does not own the station', async () => {
    const context = createContext();
    await expect(context.service.snapshot('different-host', stationId)).rejects.toMatchObject({
      key: 'errors.station.not_found',
      statusCode: 404
    });
    await expect(context.service.audit('different-host', stationId)).rejects.toMatchObject({
      key: 'errors.station.not_found',
      statusCode: 404
    });
  });

  it('exports one category/candidate summary row per result and an abstention row', async () => {
    const context = createContext({
      votes: [
        { categoryId: 'category-a', candidateId: 'candidate-a', count: 2 },
        { categoryId: 'category-a', candidateId: null, count: 1 }
      ]
    });
    const csv = await context.service.exportCsv(hostId, stationId);
    expect(csv).toContain('"category","candidate","votes","percentage","is_leader","is_tie"');
    expect(csv).toContain('"Mayor","A Candidate","2","66.67","true","false"');
    expect(csv).toContain('"Mayor","ABSTAIN","1","","false","false"');
  });
});

function createContext(
  options: {
    station?: Partial<TestStation>;
    counts?: AnalyticsCounts;
    votes?: AnalyticsVoteCount[];
    now?: () => Date;
  } = {}
) {
  const station: TestStation = {
    id: stationId,
    publicId: 'public-id',
    hostId,
    name: 'Analytics station',
    description: null,
    mode: 'CLOSED_VOTE',
    status: 'VOTE_OPEN',
    resultsVisibility: 'IMMEDIATE',
    allowAbstain: true,
    mobileOnly: false,
    voterCap: 500,
    registrationDurationHours: 12,
    votingDurationMinutes: 720,
    isLaunched: true,
    regStartsAt: null,
    regEndsAt: null,
    voteStartsAt: new Date(now.getTime() - 60_000),
    voteEndsAt: new Date(now.getTime() + 60 * 60 * 1000),
    closedAt: null,
    createdAt: now,
    ...options.station
  };
  const categories: AnalyticsCategory[] = [
    {
      id: 'category-a',
      pollingStationId: stationId,
      title: 'Mayor',
      displayOrder: 0,
      createdAt: now
    }
  ];
  let votes = options.votes ?? [];
  const repository: TestAnalyticsRepository = {
    station,
    votes,
    counts: options.counts ?? { ballotsCast: 0, approvedVoters: 0, possibleDuplicates: 0 },
    ownershipCheckCount: 0,
    snapshotQueryCount: 0,
    async findOwnedStation(foundHostId, foundStationId) {
      this.ownershipCheckCount += 1;
      return foundHostId === hostId && foundStationId === stationId ? station : undefined;
    },
    async countClosedVoteBallots() {
      this.snapshotQueryCount += 1;
      return this.counts;
    },
    async countPublicPollBallots() {
      this.snapshotQueryCount += 1;
      return this.counts;
    },
    async listCategories() {
      return categories;
    },
    async listCandidates() {
      return [
        {
          id: 'candidate-a',
          categoryId: 'category-a',
          name: 'A Candidate',
          cloudinaryImageUrl: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'candidate-b',
          categoryId: 'category-a',
          name: 'B Candidate',
          cloudinaryImageUrl: null,
          createdAt: now,
          updatedAt: now
        }
      ];
    },
    async countVotesByCategory() {
      return this.votes;
    },
    async listAuditRows() {
      return [
        { voterId: 'voter-a', fullName: 'Voter A', votedAt: new Date('2026-10-18T11:59:00.000Z') }
      ];
    }
  };
  const cache = new InMemoryAnalyticsSnapshotCache();
  const service = new AnalyticsService(repository, cache, options.now ?? (() => now));
  return {
    service,
    repository,
    cache,
    set votes(value: AnalyticsVoteCount[]) {
      votes = value;
      repository.votes = value;
    }
  };
}

type TestStation = import('./analytics.repository.js').AnalyticsStation;
type TestAnalyticsRepository = AnalyticsRepositoryPort & {
  station: TestStation;
  votes: AnalyticsVoteCount[];
  counts: AnalyticsCounts;
  ownershipCheckCount: number;
  snapshotQueryCount: number;
};
