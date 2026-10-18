import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { VotingController } from '../controllers/voting.controller.js';
import { createErrorHandler } from '../core/error-handler.js';
import type { Logger } from '../core/logger.js';
import type { RateLimiter } from './rate-limiter.js';
import type {
  VotingCandidate,
  VotingCategory,
  VotingDevice,
  VotingRepositoryPort,
  VotingStation,
  VotingVoter
} from './voting.repository.js';
import { VotingService } from './voting.service.js';
import { hashToken, generateVoterToken, normalizeTokenInput } from '../shared/index.js';

const stationId = '10000000-0000-4000-8000-000000000001';
const voterId = '10000000-0000-4000-8000-000000000002';
const categoryId = '10000000-0000-4000-8000-000000000003';
const candidateId = '10000000-0000-4000-8000-000000000004';
const deviceUuid = '10000000-0000-4000-8000-000000000005';
const publicId = 'public-station';
const tokenSecret = 't'.repeat(32);
const sessionSecret = 's'.repeat(32);
const alwaysAllowed: RateLimiter = { consume: () => true };
const initialTime = new Date('2026-10-18T10:00:00.000Z');

describe('VotingService', () => {
  it('submits an anonymous Closed Vote ballot and allows exactly one concurrent submit', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE', visibility: 'IMMEDIATE' });
    const entry = await context.service.enter(publicId, token, undefined, '192.0.2.1');
    if (entry.alreadyVoted) throw new Error('Expected an active ballot session');

    const submissions = await Promise.all(
      Array.from({ length: 20 }, () =>
        context.service.submitClosed(publicId, entry.ballotSession, [{ categoryId, candidateId }])
      )
    );
    expect(submissions.filter((result) => !result.alreadyVoted)).toHaveLength(1);
    expect(context.voter.hasVoted).toBe(true);
    expect(context.voter.votedAt?.toISOString()).toBe('2026-10-18T10:00:00.000Z');
    expect(context.votes).toEqual([{ categoryId, candidateId }]);
    expect(submissions.find((result) => !result.alreadyVoted)).toMatchObject({
      confirmation: 'status.vote.submitted',
      resultsAccessToken: expect.any(String)
    });
    expect(submissions.find((result) => !result.alreadyVoted)).not.toHaveProperty('selections');
  });

  it('expires the signed ballot session at the earlier two-hour limit', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE' });
    let now = initialTime;
    context.service = context.createService(() => now);
    const entry = await context.service.enter(publicId, token, undefined, '192.0.2.1');
    if (entry.alreadyVoted) throw new Error('Expected an active ballot session');
    expect(entry.expiresAt.getTime()).toBe(initialTime.getTime() + 2 * 60 * 60 * 1000);
    now = new Date(entry.expiresAt.getTime());
    await expect(
      context.service.submitClosed(publicId, entry.ballotSession, [{ categoryId, candidateId }])
    ).rejects.toMatchObject({ key: 'errors.vote.session_expired' });
  });

  it('rejects incomplete and invalid selections', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE' });
    const entry = await context.service.enter(publicId, token, undefined, '192.0.2.1');
    if (entry.alreadyVoted) throw new Error('Expected an active ballot session');
    await expect(
      context.service.submitClosed(publicId, entry.ballotSession, [])
    ).rejects.toMatchObject({
      key: 'errors.vote.partial_ballot'
    });
    await expect(
      context.service.submitClosed(publicId, entry.ballotSession, [
        { categoryId, candidateId: '10000000-0000-4000-8000-000000000006' }
      ])
    ).rejects.toMatchObject({ key: 'errors.vote.invalid_selection' });
  });

  it('enforces abstention configuration', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE', allowAbstain: false });
    const entry = await context.service.enter(publicId, token, undefined, '192.0.2.1');
    if (entry.alreadyVoted) throw new Error('Expected an active ballot session');
    await expect(
      context.service.submitClosed(publicId, entry.ballotSession, [
        { categoryId, candidateId: 'ABSTAIN' }
      ])
    ).rejects.toMatchObject({ key: 'errors.vote.abstain_not_allowed' });
  });

  it('locks wrong phone attempts and flags ten failed attempts', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE' });
    const wrongToken = generateVoterToken();
    let now = initialTime;
    context.service = context.createService(() => now);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const expectedKey = attempt >= 5 ? 'errors.vote.token_locked' : 'errors.vote.invalid_token';
      await expect(
        context.service.enter(publicId, wrongToken, '0991234567', '192.0.2.2')
      ).rejects.toMatchObject({ key: expectedKey });
      if (attempt === 5) {
        expect(context.voter.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60 * 1000);
      }
      if (attempt < 10 && attempt >= 5) {
        now = new Date(now.getTime() + 15 * 60 * 1000);
      }
    }
    expect(context.voter.flagReason).toBe('flags.voter.token_attempts_exceeded');
  });

  it('limits token entry by IP and Closed Vote submissions by voter', async () => {
    const token = generateVoterToken();
    const entryLimited = await createContext({
      token,
      mode: 'CLOSED_VOTE',
      ipRateLimited: true
    });
    await expect(
      entryLimited.service.enter(publicId, token, undefined, '192.0.2.1')
    ).rejects.toMatchObject({ key: 'errors.vote.rate_limited' });

    const submitLimited = await createContext({
      token,
      mode: 'CLOSED_VOTE',
      phoneRateLimited: true
    });
    const entry = await submitLimited.service.enter(publicId, token, undefined, '192.0.2.1');
    if (entry.alreadyVoted) throw new Error('Expected an active ballot session');
    await expect(
      submitLimited.service.submitClosed(publicId, entry.ballotSession, [
        { categoryId, candidateId }
      ])
    ).rejects.toMatchObject({ key: 'errors.vote.rate_limited' });

    const publicSubmitLimited = await createContext({
      mode: 'PUBLIC_POLL',
      ipRateLimited: true
    });
    await expect(
      publicSubmitLimited.service.submitPublic(
        publicId,
        [{ categoryId, candidateId }],
        deviceUuid,
        'fingerprint'
      )
    ).rejects.toMatchObject({ key: 'errors.vote.rate_limited' });
  });

  it('does not include a supplied voter token in authentication errors', async () => {
    const suppliedToken = generateVoterToken();
    const context = await createContext({ mode: 'CLOSED_VOTE' });
    const loggedErrors: Record<string, unknown>[] = [];
    const logger: Logger = {
      info: () => undefined,
      warn: () => undefined,
      error: (fields) => loggedErrors.push(fields)
    };
    const app = express();
    app.use(express.json());
    app.use((_request, response, next) => {
      response.locals.votingService = context.service;
      next();
    });
    app.post('/api/v1/public/stations/:publicId/vote/enter', new VotingController().enter);
    app.use(createErrorHandler(logger));

    const response = await request(app)
      .post(`/api/v1/public/stations/${publicId}/vote/enter`)
      .send({ token: suppliedToken });
    expect(response.status).toBe(401);
    expect(response.text).not.toContain(suppliedToken);
    expect(JSON.stringify(loggedErrors)).not.toContain(suppliedToken);
  });

  it('does not let revoked or unapproved voters enter the ballot', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE', approvalStatus: 'REVOKED' });
    await expect(
      context.service.enter(publicId, token, undefined, '192.0.2.1')
    ).rejects.toMatchObject({ key: 'errors.vote.not_approved' });
  });

  it('accepts token and normalized phone only when they belong to the same voter', async () => {
    const token = generateVoterToken();
    const context = await createContext({ token, mode: 'CLOSED_VOTE' });
    const accepted = await context.service.enter(publicId, token, '099 123 4567', '192.0.2.1');
    expect(accepted.alreadyVoted).toBe(false);
    await expect(
      context.service.enter(publicId, token, '099 123 4568', '192.0.2.1')
    ).rejects.toMatchObject({ key: 'errors.vote.invalid_token' });
  });

  it('rejects repeated Public Poll devices and enforces the ballot ceiling', async () => {
    const context = await createContext({ mode: 'PUBLIC_POLL', ceiling: 1 });
    const selection = [{ categoryId, candidateId }];
    await context.service.submitPublic(publicId, selection, deviceUuid, 'fingerprint');
    await expect(
      context.service.submitPublic(publicId, selection, deviceUuid, 'fingerprint')
    ).rejects.toMatchObject({ key: 'errors.vote.duplicate_device' });
    await expect(
      context.service.submitPublic(
        publicId,
        selection,
        '10000000-0000-4000-8000-000000000006',
        'different-fingerprint'
      )
    ).rejects.toMatchObject({ key: 'errors.vote.capacity_reached' });
  });

  it('serializes Public Poll submissions at the capacity boundary', async () => {
    const context = await createContext({ mode: 'PUBLIC_POLL', ceiling: 1 });
    const submissions = await Promise.allSettled([
      context.service.submitPublic(
        publicId,
        [{ categoryId, candidateId }],
        deviceUuid,
        'fingerprint-a'
      ),
      context.service.submitPublic(
        publicId,
        [{ categoryId, candidateId }],
        '10000000-0000-4000-8000-000000000006',
        'fingerprint-b'
      )
    ]);
    expect(submissions.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(submissions.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('accepts fingerprint-only matches and gates results by visibility and access token', async () => {
    const context = await createContext({ mode: 'PUBLIC_POLL', visibility: 'IMMEDIATE' });
    const submitted = await context.service.submitPublic(
      publicId,
      [{ categoryId, candidateId }],
      deviceUuid,
      'fingerprint'
    );
    await expect(context.service.results(publicId, undefined)).rejects.toMatchObject({
      key: 'errors.vote.results_access_required'
    });
    await expect(
      context.service.results(publicId, submitted.resultsAccessToken)
    ).resolves.toMatchObject([
      {
        id: categoryId,
        results: [
          { candidateId, count: 1 },
          { candidateId: 'ABSTAIN', count: 0 }
        ]
      }
    ]);
    const second = await context.service.submitPublic(
      publicId,
      [{ categoryId, candidateId }],
      '10000000-0000-4000-8000-000000000006',
      'fingerprint'
    );
    expect(second.confirmation).toBe('status.vote.submitted');
  });

  it('reveals concealed results to anyone only after voting closes', async () => {
    const context = await createContext({
      mode: 'PUBLIC_POLL',
      visibility: 'CONCEALED',
      status: 'VOTE_CLOSED'
    });
    await expect(context.service.results(publicId, undefined)).resolves.toHaveLength(1);
  });

  it('does not grant concealed results early even to a voter access token', async () => {
    const context = await createContext({
      mode: 'PUBLIC_POLL',
      visibility: 'CONCEALED',
      status: 'VOTE_OPEN'
    });
    const submitted = await context.service.submitPublic(
      publicId,
      [{ categoryId, candidateId }],
      deviceUuid,
      'fingerprint'
    );
    await expect(
      context.service.results(publicId, submitted.resultsAccessToken)
    ).rejects.toMatchObject({ key: 'errors.vote.results_access_required' });
  });
});

async function createContext(
  options: {
    token?: string;
    mode?: VotingStation['mode'];
    status?: VotingStation['status'];
    visibility?: VotingStation['resultsVisibility'];
    allowAbstain?: boolean;
    ipRateLimited?: boolean;
    phoneRateLimited?: boolean;
    approvalStatus?: VotingVoter['approvalStatus'];
    ceiling?: number;
  } = {}
) {
  const station: VotingStation = {
    id: stationId,
    publicId,
    hostId: '10000000-0000-4000-8000-000000000007',
    name: 'Voting station',
    description: null,
    mode: options.mode ?? 'CLOSED_VOTE',
    status: options.status ?? 'VOTE_OPEN',
    resultsVisibility: options.visibility ?? 'CONCEALED',
    allowAbstain: options.allowAbstain ?? true,
    mobileOnly: false,
    voterCap: 100,
    registrationDurationHours: 12,
    votingDurationMinutes: 720,
    isLaunched: true,
    regStartsAt: null,
    regEndsAt: null,
    voteStartsAt: new Date(initialTime.getTime() - 1000),
    voteEndsAt: new Date(initialTime.getTime() + 24 * 60 * 60 * 1000),
    closedAt: null,
    createdAt: initialTime
  };
  const voter: VotingVoter = {
    id: voterId,
    pollingStationId: stationId,
    fullName: 'Test Voter',
    phoneNumber: '265991234567',
    approvalStatus: options.approvalStatus ?? 'APPROVED',
    rejectionReason: null,
    registrationAttempts: 1,
    blocked: false,
    tokenHash: options.token ? await tokenHash(options.token) : null,
    failedAttempts: 0,
    lockedUntil: null,
    deviceFingerprintHash: null,
    clientDeviceUuid: null,
    ipHash: null,
    flagReason: null,
    hasVoted: false,
    votedAt: null,
    registeredAt: initialTime,
    approvedAt: initialTime
  };
  const category: VotingCategory = {
    id: categoryId,
    pollingStationId: stationId,
    title: 'Mayor',
    displayOrder: 1,
    createdAt: initialTime
  };
  const candidate: VotingCandidate = {
    id: candidateId,
    categoryId,
    name: 'Candidate A',
    cloudinaryImageUrl: null,
    createdAt: initialTime,
    updatedAt: initialTime
  };
  const devices: VotingDevice[] = [];
  const votes: Array<{ categoryId: string; candidateId: string | null }> = [];
  let queue = Promise.resolve();
  const repository: VotingRepositoryPort = {
    async withTransaction(operation) {
      const previous = queue;
      let release: () => void = () => undefined;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(repository);
      } finally {
        release();
      }
    },
    async findStation(foundPublicId) {
      return foundPublicId === publicId ? station : undefined;
    },
    async findVoterByTokenHash(_stationId, tokenHashValue) {
      return voter.tokenHash === tokenHashValue ? voter : undefined;
    },
    async findVoterByPhone(_stationId, phoneNumber) {
      return phoneNumber === voter.phoneNumber ? voter : undefined;
    },
    async findVoter(_stationId, foundVoterId) {
      return foundVoterId === voterId ? voter : undefined;
    },
    async updateVoter(_id, values) {
      Object.assign(voter, values);
      return voter;
    },
    async listCategories() {
      return [category];
    },
    async listCandidates() {
      return [candidate];
    },
    async insertVotes(_pollingStationId, selections) {
      votes.push(...selections);
    },
    async findDevice(_stationId, foundDeviceUuid) {
      return devices.find((record) => record.clientDeviceUuid === foundDeviceUuid);
    },
    async insertDevice(values) {
      const device: VotingDevice = {
        id: crypto.randomUUID(),
        pollingStationId: stationId,
        clientDeviceUuid: values.clientDeviceUuid ?? deviceUuid,
        deviceFingerprintHash: values.deviceFingerprintHash ?? null,
        hasVoted: values.hasVoted ?? true,
        createdAt: initialTime
      };
      devices.push(device);
      return device;
    },
    async updateDevice(deviceId, values) {
      const device = devices.find((record) => record.id === deviceId);
      if (!device) return undefined;
      Object.assign(device, values);
      return device;
    },
    async countVotedDevices() {
      return devices.filter((device) => device.hasVoted).length;
    },
    async listResults() {
      return votes.reduce<Array<{ categoryId: string; candidateId: string | null; count: number }>>(
        (results, vote) => {
          const existing = results.find(
            (item) => item.categoryId === vote.categoryId && item.candidateId === vote.candidateId
          );
          if (existing) existing.count += 1;
          else results.push({ ...vote, count: 1 });
          return results;
        },
        []
      );
    }
  };
  const createService = (now: () => Date = () => initialTime) =>
    new VotingService(repository, {
      config: {
        tokenHmacSecret: tokenSecret,
        sessionSecret,
        publicPollBallotCeiling: options.ceiling ?? 2500
      },
      ipRateLimiter: options.ipRateLimited ? { consume: () => false } : alwaysAllowed,
      phoneRateLimiter: options.phoneRateLimited ? { consume: () => false } : alwaysAllowed,
      now
    });
  return { service: createService(), createService, voter, votes };
}

async function tokenHash(token: string): Promise<string> {
  const normalized = normalizeTokenInput(token);
  if (!normalized.ok) throw new Error('Test token should be valid');
  return hashToken(tokenSecret, stationId, normalized.normalized);
}
