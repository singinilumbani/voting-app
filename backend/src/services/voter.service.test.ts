import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../shared/index.js';
import type { RateLimiter } from './rate-limiter.js';
import type {
  VoterCounts,
  VoterRecord,
  VoterRepositoryPort,
  VoterStationRecord
} from './voter.repository.js';
import { VoterService } from './voter.service.js';

const stationId = '00000000-0000-4000-8000-000000000001';
const hostId = '00000000-0000-4000-8000-000000000002';
const publicId = 'station-public-id';
const now = new Date('2026-10-18T10:00:00.000Z');
const alwaysAllowed: RateLimiter = { consume: () => true };
const tokenSecret = 'x'.repeat(32);

describe('VoterService', () => {
  it('counts pending and approved registrations against the cap', async () => {
    const context = createContext({ voterCap: 2 });
    context.addVoter({ phoneNumber: '265991111111', approvalStatus: 'PENDING' });
    context.addVoter({ phoneNumber: '265992222222', approvalStatus: 'APPROVED' });

    await expect(
      context.service.register(publicId, registration('0993333333'))
    ).rejects.toMatchObject({
      key: 'errors.registration.full'
    });
  });

  it('serializes concurrent registrations at the cap boundary', async () => {
    const context = createContext({ voterCap: 2 });
    context.addVoter({ phoneNumber: '265991111111', approvalStatus: 'APPROVED' });
    const results = await Promise.allSettled([
      context.service.register(publicId, registration('0992222222')),
      context.service.register(publicId, registration('0993333333'))
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(context.capacityCount()).toBe(2);
  });

  it('rejects duplicate active phone registrations with the duplicate guidance key', async () => {
    const context = createContext();
    context.addVoter({ phoneNumber: '265991234567', approvalStatus: 'PENDING' });
    await expect(
      context.service.register(publicId, registration('0991234567'))
    ).rejects.toMatchObject({
      key: 'errors.registration.already_registered'
    });
  });

  it('returns a newly generated token only in the successful registration response', async () => {
    const context = createContext();
    await expect(context.service.register(publicId, registration('0991234567'))).resolves.toEqual({
      token: 'TK-1234-5678-9ABC',
      status: 'PENDING'
    });
    const voter = context.getByPhone('265991234567');
    expect(voter?.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(voter?.tokenHash).not.toBe('TK-1234-5678-9ABC');
  });

  it('allows three total registration attempts after host rejection', async () => {
    const context = createContext();
    const hostVoterId = await context.register('0991234567');
    await context.service.reject(hostId, stationId, hostVoterId);
    await context.service.register(publicId, registration('099 123 4567'));
    await context.service.reject(hostId, stationId, hostVoterId);
    await context.service.register(publicId, registration('+265 99 123 4567'));
    await context.service.reject(hostId, stationId, hostVoterId);

    await expect(
      context.service.register(publicId, registration('00265991234567'))
    ).rejects.toMatchObject({ key: 'errors.registration.attempts_exceeded' });
    expect(context.getVoter(hostVoterId)?.registrationAttempts).toBe(3);
  });

  it('reopens a freed capacity slot after a voter is rejected', async () => {
    const context = createContext({ voterCap: 2 });
    const voterId = await context.register('0991111111');
    await context.register('0993333333');
    await context.service.reject(hostId, stationId, voterId);
    await expect(
      context.service.register(publicId, registration('0992222222'))
    ).resolves.toMatchObject({
      status: 'PENDING'
    });
  });

  it('prevents a host-blocked phone number from registering again', async () => {
    const context = createContext();
    const voterId = await context.register('0991234567');
    await context.service.blockNumber(hostId, stationId, voterId);
    await expect(
      context.service.register(publicId, registration('0991234567'))
    ).rejects.toMatchObject({
      key: 'errors.registration.blocked'
    });
  });

  it('reissues an approved voter token and invalidates the previous token', async () => {
    const tokens = ['TK-1111-1111-1111', 'TK-2222-2222-2222'];
    const context = createContext({ tokens });
    const voterId = await context.register('0991234567');
    await context.service.approve(hostId, stationId, voterId);
    const oldToken = tokens[0]!;
    const newToken = await context.service.reissueToken(hostId, stationId, voterId);

    await expect(context.service.status(publicId, oldToken, '192.0.2.1')).rejects.toMatchObject({
      key: 'errors.registration.not_found'
    });
    await expect(context.service.status(publicId, newToken.token, '192.0.2.1')).resolves.toEqual({
      status: 'APPROVED'
    });
    expect(context.getVoter(voterId)?.failedAttempts).toBe(0);
    expect(context.getVoter(voterId)?.lockedUntil).toBeNull();
  });

  it('locks approvals after voting opens', async () => {
    const context = createContext({ status: 'VOTE_OPEN' });
    const voterId = context.addVoter({ approvalStatus: 'PENDING' });
    await expect(context.service.approve(hostId, stationId, voterId)).rejects.toMatchObject({
      key: 'errors.voter.approval_locked'
    });
  });

  it('allows approvals during the registration review period', async () => {
    const context = createContext({ status: 'REG_CLOSED' });
    const voterId = context.addVoter({ approvalStatus: 'PENDING' });
    await expect(context.service.approve(hostId, stationId, voterId)).resolves.toMatchObject({
      approvalStatus: 'APPROVED'
    });
  });

  it('rate limits repeated status checks', async () => {
    const context = createContext({ statusRateLimited: true });
    await expect(
      context.service.status(publicId, 'TK-1234-5678-9ABC', '192.0.2.1')
    ).rejects.toMatchObject({ key: 'errors.registration.rate_limited' });
  });

  it('flags other registrations that share a device without blocking them', async () => {
    const context = createContext();
    context.addVoter({
      clientDeviceUuid: '00000000-0000-4000-8000-000000000099',
      deviceFingerprintHash: 'f'.repeat(64),
      flagReason: 'flags.voter.token_attempts_exceeded'
    });
    context.addVoter({
      clientDeviceUuid: '00000000-0000-4000-8000-000000000099',
      deviceFingerprintHash: 'e'.repeat(64)
    });
    const list = await context.service.list(hostId, stationId, {
      search: '',
      page: 1,
      pageSize: 25
    });
    expect(list.voters[0]).toMatchObject({ deviceFlag: 'SAME_DEVICE_AS_1' });
    expect(list.voters).toContainEqual(
      expect.objectContaining({ flagReason: 'flags.voter.token_attempts_exceeded' })
    );
  });

  it('exports only names, phone numbers, and statuses, never tokens', async () => {
    const context = createContext();
    const voterId = await context.register('0991234567');
    const csv = await context.service.exportCsv(hostId, stationId);
    expect(csv).toContain('"full_name","phone_number","status"');
    expect(csv).toContain('"Ada Voter","265991234567","PENDING"');
    expect(csv).not.toContain('TK-');
    expect(csv).not.toContain(context.getVoter(voterId)?.tokenHash);
  });

  it('returns a phone reason key for invalid phone input', async () => {
    const context = createContext();
    await expect(
      context.service.register(publicId, registration('letters only'))
    ).rejects.toMatchObject({
      key: 'errors.phone.invalid_characters'
    });
  });

  it('formats an explicitly international number in the host queue', async () => {
    const context = createContext();
    await context.service.register(publicId, registration('+27 82 123 4567'));
    const result = await context.service.list(hostId, stationId, {
      search: '',
      page: 1,
      pageSize: 25
    });
    expect(result.voters).toMatchObject([
      {
        phone: '+27821234567',
        whatsappUrl: 'https://wa.me/27821234567'
      }
    ]);
  });

  it('records activity for host actions', async () => {
    const context = createContext();
    const voterId = await context.register('0991234567');
    await context.service.approve(hostId, stationId, voterId);
    await context.service.revoke(hostId, stationId, voterId);
    await context.service.blockNumber(hostId, stationId, voterId);
    expect(context.events).toEqual(['VOTER_APPROVED', 'VOTER_REVOKED', 'VOTER_BLOCKED']);
  });
});

function registration(phone: string) {
  return {
    fullName: 'Ada Voter',
    phone,
    deviceUuid: '00000000-0000-4000-8000-000000000003',
    fingerprintHash: 'fingerprint',
    ip: '192.0.2.10'
  };
}

function createContext(
  options: {
    voterCap?: number;
    status?: VoterStationRecord['status'];
    tokens?: string[];
    statusRateLimited?: boolean;
  } = {}
) {
  const station: VoterStationRecord = {
    id: stationId,
    publicId,
    hostId,
    name: 'Closed Vote',
    description: null,
    mode: 'CLOSED_VOTE',
    status: options.status ?? 'REG_OPEN',
    resultsVisibility: 'CONCEALED',
    allowAbstain: false,
    mobileOnly: true,
    voterCap: options.voterCap ?? 500,
    registrationDurationHours: 12,
    votingDurationMinutes: 720,
    isLaunched: true,
    regStartsAt: now,
    regEndsAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
    voteStartsAt: null,
    voteEndsAt: null,
    closedAt: null,
    createdAt: now
  };
  const voters: VoterRecord[] = [];
  const events: string[] = [];
  let tokenIndex = 0;
  let transactionQueue = Promise.resolve();
  const repository: VoterRepositoryPort = {
    async withTransaction(operation) {
      const prior = transactionQueue;
      let release: () => void = () => undefined;
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prior;
      try {
        return await operation(repository);
      } finally {
        release();
      }
    },
    async findPublicStation(foundPublicId) {
      return foundPublicId === publicId ? station : undefined;
    },
    async findOwnedStation(foundHostId, foundStationId) {
      return foundHostId === hostId && foundStationId === stationId ? station : undefined;
    },
    async findByPhone(foundStationId, phoneNumber) {
      return foundStationId === stationId
        ? voters.find((voter) => voter.phoneNumber === phoneNumber)
        : undefined;
    },
    async findByTokenHash(foundStationId, tokenHash) {
      return foundStationId === stationId
        ? voters.find((voter) => voter.tokenHash === tokenHash)
        : undefined;
    },
    async findVoter(foundStationId, voterId) {
      return foundStationId === stationId
        ? voters.find((voter) => voter.id === voterId)
        : undefined;
    },
    async countCapacityRegistrations() {
      return voters.filter((voter) => ['PENDING', 'APPROVED'].includes(voter.approvalStatus))
        .length;
    },
    async createVoter(values) {
      const voter = makeVoter(values);
      voters.push(voter);
      return voter;
    },
    async updateVoter(voterId, values) {
      const voter = voters.find((record) => record.id === voterId);
      if (!voter) return undefined;
      Object.assign(voter, values);
      return voter;
    },
    async listVoters() {
      return voters;
    },
    async listPendingVoterIds() {
      return voters.filter((voter) => voter.approvalStatus === 'PENDING').map(({ id }) => id);
    },
    async countVoters(): Promise<VoterCounts> {
      return {
        pending: voters.filter((voter) => voter.approvalStatus === 'PENDING').length,
        approved: voters.filter((voter) => voter.approvalStatus === 'APPROVED').length,
        rejected: voters.filter((voter) => voter.approvalStatus === 'REJECTED').length,
        revoked: voters.filter((voter) => voter.approvalStatus === 'REVOKED').length,
        voted: voters.filter((voter) => voter.hasVoted).length
      };
    },
    async voterIntegrity() {
      return { approvedVoters: 0, ballotsCast: 0, abstentions: 0, possibleDuplicates: 0 };
    },
    async addActivity(values) {
      events.push(values.eventType);
    }
  };
  const service = new VoterService(repository, {
    config: { tokenHmacSecret: tokenSecret },
    registrationRateLimiter: alwaysAllowed,
    statusRateLimiter: options.statusRateLimited ? { consume: () => false } : alwaysAllowed,
    now: () => now,
    tokenGenerator: () => {
      const tokens = options.tokens ?? ['TK-1234-5678-9ABC'];
      const token = tokens[tokenIndex % tokens.length];
      tokenIndex += 1;
      if (!token) throw new Error('No test token configured');
      return token;
    }
  });
  return {
    service,
    events,
    async register(phone: string) {
      const result = await service.register(publicId, registration(phone));
      const normalizedPhone = normalizePhone(phone);
      const voter = normalizedPhone.ok
        ? voters.find((record) => record.phoneNumber === normalizedPhone.canonical)
        : undefined;
      if (!voter) throw new Error('Expected registered voter');
      expect(result.status).toBe('PENDING');
      return voter.id;
    },
    addVoter(values: Partial<VoterRecord> = {}) {
      const id = values.id ?? crypto.randomUUID();
      const voter = makeVoter({
        pollingStationId: stationId,
        fullName: 'Test Voter',
        phoneNumber: `265991${String(voters.length).padStart(6, '0')}`,
        approvalStatus: 'PENDING',
        registrationAttempts: 1,
        blocked: false,
        tokenHash: null,
        failedAttempts: 0,
        lockedUntil: null,
        deviceFingerprintHash: null,
        clientDeviceUuid: null,
        ipHash: null,
        flagReason: null,
        hasVoted: false,
        votedAt: null,
        registeredAt: now,
        approvedAt: null,
        ...values,
        id
      });
      voters.push(voter);
      return id;
    },
    getVoter(voterId: string) {
      return voters.find((voter) => voter.id === voterId);
    },
    getByPhone(phoneNumber: string) {
      return voters.find((voter) => voter.phoneNumber === phoneNumber);
    },
    capacityCount() {
      return voters.filter((voter) => ['PENDING', 'APPROVED'].includes(voter.approvalStatus))
        .length;
    }
  };
}

function makeVoter(
  values: Partial<VoterRecord> & Pick<VoterRecord, 'pollingStationId' | 'fullName' | 'phoneNumber'>
): VoterRecord {
  return {
    id: values.id ?? crypto.randomUUID(),
    pollingStationId: values.pollingStationId,
    fullName: values.fullName,
    phoneNumber: values.phoneNumber,
    approvalStatus: values.approvalStatus ?? 'PENDING',
    rejectionReason: values.rejectionReason ?? null,
    registrationAttempts: values.registrationAttempts ?? 1,
    blocked: values.blocked ?? false,
    tokenHash: values.tokenHash ?? null,
    failedAttempts: values.failedAttempts ?? 0,
    lockedUntil: values.lockedUntil ?? null,
    deviceFingerprintHash: values.deviceFingerprintHash ?? null,
    clientDeviceUuid: values.clientDeviceUuid ?? null,
    ipHash: values.ipHash ?? null,
    flagReason: values.flagReason ?? null,
    hasVoted: values.hasVoted ?? false,
    votedAt: values.votedAt ?? null,
    registeredAt: values.registeredAt ?? now,
    approvedAt: values.approvedAt ?? null
  };
}
