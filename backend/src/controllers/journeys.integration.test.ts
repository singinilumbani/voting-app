import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { loadConfig } from '../config/env.js';
import type { DbClient } from '../db/client.js';
import { createTestDatabase, truncateTestDatabase } from '../db/test-helpers.js';
import { pollingStations } from '../db/schema/polling-stations.js';
import { createContainer } from '../container.js';
import { JobsRepository } from '../modules/jobs/jobs.repository.js';
import { stationTick } from '../modules/jobs/jobs.js';
import { VotingRepository } from '../repositories/voting.repository.js';
import type { EmailService } from '../services/email.service.js';
import { InMemoryRateLimiter } from '../services/rate-limiter.js';
import { Pbkdf2PasswordHasher } from '../services/password-hasher.js';

const databaseConfigured =
  process.env.TEST_DATABASE_URL !== undefined || process.env.DATABASE_URL !== undefined;
const tokenHmacSecret = 'journey-integration-token-secret-32-bytes';
const sessionSecret = 'journey-integration-session-secret-32-bytes';

describe.skipIf(!databaseConfigured)('complete station HTTP journeys', () => {
  let client: DbClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    client = await createTestDatabase();
    const config = loadConfig({
      ...process.env,
      APP_ENV: 'test',
      DB_DRIVER: 'pg',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
      PASSWORD_HASH_ITERATIONS: '1000',
      ENABLE_EMAIL_VERIFICATION: 'false',
      TOKEN_HMAC_SECRET: tokenHmacSecret,
      SESSION_SECRET: sessionSecret,
      APP_BASE_URL: 'https://app.example.test'
    });
    const mailer: EmailService = { send: async () => undefined };
    app = createApp(
      createContainer(config, {
        createDatabaseClient: async () => client,
        emailService: mailer,
        passwordHasher: new Pbkdf2PasswordHasher(1000),
        rateLimiter: new InMemoryRateLimiter(50_000),
        rateLimitBindings: {
          strict: { limit: async () => ({ success: true }) },
          loose: { limit: async () => ({ success: true }) }
        }
      })
    );
  });

  beforeEach(async () => {
    await truncateTestDatabase(client);
  });

  afterAll(async () => {
    await client?.close();
  });

  it('runs Closed Vote signup through final results with 50 racing ballot submissions', async () => {
    const cookie = await signupHost();
    const station = await createStation(cookie, 'CLOSED_VOTE', 50);
    const registered = await Promise.all([
      registerVoter(station.publicId, 1),
      registerVoter(station.publicId, 2)
    ]);

    for (const voter of registered) {
      const status = await request(app)
        .post(`/api/v1/public/stations/${station.publicId}/status`)
        .send({ token: voter.token });
      expect(status.status).toBe(200);
      expect(status.body.status).toBe('PENDING');
    }

    const queue = await request(app)
      .get(`/api/v1/host/stations/${station.id}/voters`)
      .set('Cookie', cookie);
    expect(queue.status).toBe(200);
    const queuedVoters = queue.body.voters as Array<{ id: string; fullName: string }>;
    const voterIdsByName = new Map(queuedVoters.map((voter) => [voter.fullName, voter.id]));
    const approvalRequests = registered.map((voter) => {
      const voterId = voterIdsByName.get(voter.name);
      if (!voterId) throw new Error('Registered voter was missing from the approval queue');
      return request(app)
        .post(`/api/v1/host/stations/${station.id}/voters/${voterId}/approve`)
        .set('Cookie', cookie);
    });
    const approvals = await Promise.all(approvalRequests);
    expect(approvals.map((response) => response.status)).toEqual([200, 200]);

    await client.db
      .update(pollingStations)
      .set({ regEndsAt: new Date(Date.now() - 1_000) })
      .where(eq(pollingStations.id, station.id));
    const registrationTick = await stationTick(JobsRepository.fromClient(client), {
      now: new Date(),
      retentionDays: 7
    });
    expect(registrationTick.registrationsClosed).toBe(1);

    const warning = await request(app)
      .post(`/api/v1/host/stations/${station.id}/start-voting`)
      .set('Cookie', cookie)
      .send({});
    expect(warning.status).toBe(200);
    expect(warning.body).toMatchObject({
      requiresConfirmation: true,
      pendingCount: 0
    });
    const started = await request(app)
      .post(`/api/v1/host/stations/${station.id}/start-voting`)
      .set('Cookie', cookie)
      .send({ confirm: true });
    expect(started.status).toBe(200);
    expect(started.body.station.status).toBe('VOTE_OPEN');

    const [lowCandidateId, highCandidateId] = [...station.candidateIds].sort();
    if (!lowCandidateId || !highCandidateId) throw new Error('Expected two candidates');
    const firstEntry = await request(app)
      .post(`/api/v1/public/stations/${station.publicId}/vote/enter`)
      .send({ token: registered[0]!.token });
    expect(firstEntry.status).toBe(200);
    const ballotSession = firstEntry.body.ballotSession as string;
    const highSelection = [{ categoryId: station.categoryId, candidateId: highCandidateId }];

    const parallelSubmissions = await Promise.all(
      Array.from({ length: 50 }, () =>
        request(app)
          .post(`/api/v1/public/stations/${station.publicId}/vote/submit`)
          .set('Authorization', `Bearer ${ballotSession}`)
          .send({ selections: highSelection })
      )
    );
    expect(parallelSubmissions.filter((response) => response.status === 200)).toHaveLength(1);
    expect(parallelSubmissions.filter((response) => response.status === 409)).toHaveLength(49);
    expect(parallelSubmissions.find((response) => response.status === 200)?.body).not.toHaveProperty(
      'candidateId'
    );

    const secondEntry = await request(app)
      .post(`/api/v1/public/stations/${station.publicId}/vote/enter`)
      .send({ token: registered[1]!.token });
    expect(secondEntry.status).toBe(200);
    const secondVote = await request(app)
      .post(`/api/v1/public/stations/${station.publicId}/vote/submit`)
      .set('Authorization', `Bearer ${secondEntry.body.ballotSession as string}`)
      .send({
        selections: [{ categoryId: station.categoryId, candidateId: lowCandidateId }]
      });
    expect(secondVote.status).toBe(200);

    const analytics = await request(app)
      .get(`/api/v1/host/stations/${station.id}/analytics/snapshot`)
      .set('Cookie', cookie);
    expect(analytics.status).toBe(200);
    expect(analytics.body).toMatchObject({
      state: 'LIVE',
      ballotsCast: 2,
      approvedVoters: 2,
      turnoutPercent: 100
    });
    const audit = await request(app)
      .get(`/api/v1/host/stations/${station.id}/analytics/audit`)
      .set('Cookie', cookie);
    expect(audit.status).toBe(200);
    expect(JSON.stringify(audit.body)).not.toContain('Candidate');

    const tallyRows = await VotingRepository.fromClient(client).listResults(station.id);
    expect(tallyRows.map((row) => row.candidateId)).toEqual([lowCandidateId, highCandidateId]);

    await client.db
      .update(pollingStations)
      .set({ voteEndsAt: new Date(Date.now() - 1_000) })
      .where(eq(pollingStations.id, station.id));
    const closeTick = await stationTick(JobsRepository.fromClient(client), {
      now: new Date(),
      retentionDays: 7
    });
    expect(closeTick.votingClosed).toBe(1);

    const finalResults = await request(app).get(
      `/api/v1/public/stations/${station.publicId}/results`
    );
    expect(finalResults.status).toBe(200);
    expect(finalResults.body[0].results).toEqual(
      expect.arrayContaining([
        { candidateId: lowCandidateId, count: 1 },
        { candidateId: highCandidateId, count: 1 }
      ])
    );
    expect(JSON.stringify(finalResults.body)).not.toContain(registered[0]!.name);
  });

  it('runs Public Poll signup through final results without voter check-in data', async () => {
    const cookie = await signupHost();
    const station = await createStation(cookie, 'PUBLIC_POLL', 2);
    const response = await request(app)
      .post(`/api/v1/public/stations/${station.publicId}/vote/submit`)
      .send({
        selections: [{ categoryId: station.categoryId, candidateId: station.candidateIds[0] }],
        deviceUuid: randomUUID(),
        fingerprintHash: `public-fingerprint-${randomUUID()}`
      });
    expect(response.status).toBe(200);
    expect(response.body.confirmation).toBe('status.vote.submitted');
    expect(response.body).not.toHaveProperty('voterId');

    const snapshot = await request(app)
      .get(`/api/v1/host/stations/${station.id}/analytics/snapshot`)
      .set('Cookie', cookie);
    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toMatchObject({
      state: 'LIVE',
      ballotsCast: 1,
      approvedVoters: null
    });

    await client.db
      .update(pollingStations)
      .set({ voteEndsAt: new Date(Date.now() - 1_000) })
      .where(eq(pollingStations.id, station.id));
    const closeTick = await stationTick(JobsRepository.fromClient(client), {
      now: new Date(),
      retentionDays: 7
    });
    expect(closeTick.votingClosed).toBe(1);

    const results = await request(app).get(
      `/api/v1/public/stations/${station.publicId}/results`
    );
    expect(results.status).toBe(200);
    expect(results.body[0].results).toEqual(
      expect.arrayContaining([{ candidateId: station.candidateIds[0], count: 1 }])
    );
    const audit = await request(app)
      .get(`/api/v1/host/stations/${station.id}/analytics/audit`)
      .set('Cookie', cookie);
    expect(audit.status).toBe(200);
    expect(audit.body.events).toEqual([]);
  });

  it('serializes concurrent registration requests at the voter cap', async () => {
    const cookie = await signupHost();
    const station = await createStation(cookie, 'CLOSED_VOTE', 2);
    const initial = await registerVoter(station.publicId, 10);
    expect(initial.status).toBe(201);

    const races = await Promise.all([
      registerVoter(station.publicId, 11),
      registerVoter(station.publicId, 12)
    ]);
    expect(races.filter((response) => response.status === 201)).toHaveLength(1);
    expect(races.filter((response) => response.status === 409)).toHaveLength(1);
    expect(races.find((response) => response.status === 409)?.body.error.key).toBe(
      'errors.registration.full'
    );
  });

  async function signupHost(): Promise<string> {
    const unique = randomUUID().replaceAll('-', '');
    const response = await request(app)
      .post('/api/v1/host/auth/signup')
      .send({
        username: `host${unique.slice(0, 12)}`,
        password: 'IntegrationPassword123!',
        email: `host-${unique}@example.test`,
        accountType: 'LONG_TERM',
        termsAccepted: true
      });
    expect(response.status).toBe(201);
    const cookieHeader = response.headers['set-cookie']?.[0];
    if (typeof cookieHeader !== 'string') throw new Error('Signup did not set a session cookie');
    const cookie = cookieHeader.split(';')[0];
    if (!cookie) throw new Error('Signup returned an invalid session cookie');
    return cookie;
  }

  async function createStation(
    cookie: string,
    mode: 'CLOSED_VOTE' | 'PUBLIC_POLL',
    voterCap: number
  ): Promise<{ id: string; publicId: string; categoryId: string; candidateIds: string[] }> {
    const created = await request(app)
      .post('/api/v1/host/stations')
      .set('Cookie', cookie)
      .send({
        name: `${mode} integration ${randomUUID()}`,
        mode,
        resultsVisibility: 'CONCEALED',
        allowAbstain: true,
        mobileOnly: false
      });
    expect(created.status).toBe(201);
    const stationId = created.body.station.id as string;

    const categoryResponse = await request(app)
      .post(`/api/v1/host/stations/${stationId}/categories`)
      .set('Cookie', cookie)
      .send({ title: 'Representative' });
    expect(categoryResponse.status).toBe(201);
    const categoryId = categoryResponse.body.category.id as string;

    const candidates = await Promise.all(
      ['Candidate One', 'Candidate Two'].map((name) =>
        request(app)
          .post(`/api/v1/host/stations/${stationId}/categories/${categoryId}/candidates`)
          .set('Cookie', cookie)
          .send({ name })
      )
    );
    expect(candidates.map((candidate) => candidate.status)).toEqual([201, 201]);
    const candidateIds = candidates.map((candidate) => candidate.body.candidate.id as string);

    if (mode === 'CLOSED_VOTE') {
      const registration = await request(app)
        .put(`/api/v1/host/stations/${stationId}/registration-config`)
        .set('Cookie', cookie)
        .send({ voterCap, durationHours: 1 });
      expect(registration.status).toBe(200);
    }
    const votingConfig = await request(app)
      .put(`/api/v1/host/stations/${stationId}/voting-config`)
      .set('Cookie', cookie)
      .send({ startMode: 'NOW', durationMinutes: 15 });
    expect(votingConfig.status).toBe(200);
    const launch = await request(app)
      .post(`/api/v1/host/stations/${stationId}/launch`)
      .set('Cookie', cookie)
      .send({});
    expect(launch.status).toBe(200);

    return {
      id: stationId,
      publicId: launch.body.publicId as string,
      categoryId,
      candidateIds
    };
  }

  async function registerVoter(publicId: string, number: number) {
    const response = await request(app)
      .post(`/api/v1/public/stations/${publicId}/register`)
      .send({
        fullName: `Integration Voter ${number}`,
        phone: `099${String(9_000_000 + number).padStart(7, '0')}`,
        deviceUuid: randomUUID(),
        fingerprintHash: `integration-fingerprint-${number}-${randomUUID()}`
      });
    return {
      status: response.status,
      body: response.body,
      token: response.body.token as string,
      name: `Integration Voter ${number}`
    };
  }
});
