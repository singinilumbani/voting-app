import { describe, expect, it } from 'vitest';
import type { EmailService, HostEmailTemplateKey } from '../../services/email.service.js';
import type { JobsRepositoryPort, RetentionStation, StationTransition } from './jobs.types.js';
import { accountLifecycle, retentionPurge, stationTick } from './jobs.js';

const now = new Date('2026-10-18T12:00:00.000Z');

describe('scheduled jobs', () => {
  it('applies every due lifecycle transition and is safe to run again', async () => {
    const repository = new FakeJobsRepository();
    repository.stations = [
      station('reg-open', {
        status: 'REG_OPEN',
        regEndsAt: new Date(now.getTime() - 1)
      }),
      station('future-reg-open', {
        status: 'REG_OPEN',
        regEndsAt: new Date(now.getTime() + 1)
      }),
      station('closed-vote', {
        status: 'REG_CLOSED',
        mode: 'CLOSED_VOTE',
        voteStartsAt: new Date(now.getTime() - 1)
      }),
      station('public-poll', {
        status: 'DRAFT',
        mode: 'PUBLIC_POLL',
        isLaunched: true,
        voteStartsAt: new Date(now.getTime() - 1)
      }),
      station('vote-open', {
        status: 'VOTE_OPEN',
        voteEndsAt: new Date(now.getTime() - 1)
      })
    ];

    const first = await stationTick(repository, { now, retentionDays: 7 });
    expect(first).toEqual({
      registrationsClosed: 1,
      votingOpened: 2,
      votingClosed: 1
    });
    expect(repository.stations.map(({ status }) => status)).toEqual([
      'REG_CLOSED',
      'REG_OPEN',
      'VOTE_OPEN',
      'VOTE_OPEN',
      'VOTE_CLOSED'
    ]);
    expect(repository.closedAt.get('vote-open')).toEqual(now);
    expect(repository.temporaryPurgeDates.get('host')).toEqual(
      new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    );

    expect(await stationTick(repository, { now, retentionDays: 7 })).toEqual({
      registrationsClosed: 0,
      votingOpened: 0,
      votingClosed: 0
    });
  });

  it('purges voter and device rows in bounded batches while preserving cast-vote tallies', async () => {
    const repository = new FakeJobsRepository();
    const retentionStation = {
      id: 'station',
      hostId: 'host',
      accountType: 'TEMPORARY',
      plan: 'FREE',
      closedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } as const;
    repository.retentionStations = [
      retentionStation,
      {
        id: 'not-due',
        hostId: 'other-host',
        accountType: 'TEMPORARY',
        plan: 'FREE',
        closedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      }
    ];
    repository.records.set('station', {
      voters: 250,
      devices: 150,
      castVotes: 18,
      status: 'VOTE_CLOSED'
    });
    repository.records.set('not-due', {
      voters: 4,
      devices: 2,
      castVotes: 1,
      status: 'VOTE_CLOSED'
    });
    repository.temporaryAccountsDue = ['host'];

    const first = await retentionPurge(repository, { now, retentionDays: 7 });
    expect(first.voterRecordsDeleted).toBe(100);
    expect(first.deviceRecordsDeleted).toBe(100);
    expect(first.stationsArchived).toBe(0);
    expect(repository.records.get('station')).toMatchObject({
      voters: 150,
      devices: 50,
      castVotes: 18,
      status: 'VOTE_CLOSED'
    });
    expect(repository.records.get('not-due')).toMatchObject({
      voters: 4,
      devices: 2,
      status: 'VOTE_CLOSED'
    });

    await retentionPurge(repository, { now, retentionDays: 7 });
    const final = await retentionPurge(repository, { now, retentionDays: 7 });
    expect(final).toMatchObject({
      voterRecordsDeleted: 50,
      deviceRecordsDeleted: 0,
      stationsArchived: 1,
      accountsDeleted: 1
    });
    expect(repository.records.get('station')).toMatchObject({
      voters: 0,
      devices: 0,
      castVotes: 18,
      status: 'ARCHIVED'
    });
    expect(await retentionPurge(repository, { now, retentionDays: 7 })).toMatchObject({
      voterRecordsDeleted: 0,
      deviceRecordsDeleted: 0,
      stationsArchived: 0
    });
  });

  it('archives Premium stations without deleting their voter or device records', async () => {
    const repository = new FakeJobsRepository();
    repository.retentionStations = [
      {
        id: 'premium',
        hostId: 'host',
        accountType: 'TEMPORARY',
        plan: 'PREMIUM',
        closedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }
    ];
    repository.records.set('premium', {
      voters: 4,
      devices: 3,
      castVotes: 12,
      status: 'VOTE_CLOSED'
    });

    const result = await retentionPurge(repository, { now, retentionDays: 7 });
    expect(result.stationsArchived).toBe(1);
    expect(repository.records.get('premium')).toEqual({
      voters: 4,
      devices: 3,
      castVotes: 12,
      status: 'ARCHIVED'
    });
  });

  it('purges PAY_PER_USE station data after the configured retention window', async () => {
    const repository = new FakeJobsRepository();
    repository.retentionStations = [
      {
        id: 'pay-per-use',
        hostId: 'host',
        accountType: 'LONG_TERM',
        plan: 'PAY_PER_USE',
        closedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      }
    ];
    repository.records.set('pay-per-use', {
      voters: 1,
      devices: 1,
      castVotes: 3,
      status: 'VOTE_CLOSED'
    });

    const result = await retentionPurge(repository, { now, retentionDays: 14 });
    expect(result).toMatchObject({
      voterRecordsDeleted: 1,
      deviceRecordsDeleted: 1,
      stationsArchived: 1
    });
    expect(repository.records.get('pay-per-use')).toMatchObject({
      voters: 0,
      devices: 0,
      castVotes: 3,
      status: 'ARCHIVED'
    });
  });

  it('sends temporary and inactivity warnings once and marks six-month inactivity', async () => {
    const repository = new FakeJobsRepository();
    repository.temporaryWarnings = [
      {
        id: 'temporary',
        email: 'temporary@example.test',
        purgeAt: new Date(now.getTime() + 48 * 60 * 60 * 1000)
      }
    ];
    repository.inactiveLongTermHosts = [
      { id: 'long-term', email: 'long@example.test', lastLoginAt: new Date('2026-05-18T12:00:00Z') }
    ];
    const sent: { key: HostEmailTemplateKey; recipient: string }[] = [];
    const emailService: EmailService = {
      async send(key, recipient) {
        sent.push({ key, recipient });
      }
    };

    const first = await accountLifecycle(repository, emailService, {
      now,
      appBaseUrl: 'https://app.example.test'
    });
    expect(first).toEqual({
      temporaryWarningsSent: 1,
      inactivityWarningsSent: 1,
      longTermAccountsMarked: 0
    });
    expect(sent).toEqual([
      { key: 'host.temporary_purge_warning', recipient: 'temporary@example.test' },
      { key: 'host.inactivity_warning', recipient: 'long@example.test' }
    ]);
    expect(repository.markedLongTermAccounts).toBe(0);

    const repeated = await accountLifecycle(repository, emailService, {
      now,
      appBaseUrl: 'https://app.example.test'
    });
    expect(repeated).toEqual({
      temporaryWarningsSent: 0,
      inactivityWarningsSent: 0,
      longTermAccountsMarked: 0
    });
    expect(sent).toHaveLength(2);

    const sixMonthRun = await accountLifecycle(repository, emailService, {
      now: new Date('2026-11-18T12:00:00.000Z'),
      appBaseUrl: 'https://app.example.test'
    });
    expect(sixMonthRun.longTermAccountsMarked).toBe(1);
    expect(repository.longTermPurgeDates.get('long-term')).toEqual(
      new Date('2026-11-18T12:00:00.000Z')
    );
    expect(sent).toHaveLength(2);
  });

  it('releases a warning claim when email delivery fails so a later run can retry', async () => {
    const repository = new FakeJobsRepository();
    repository.temporaryWarnings = [
      {
        id: 'temporary',
        email: 'temporary@example.test',
        purgeAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    ];
    const failingEmail: EmailService = {
      async send() {
        throw new Error('delivery unavailable');
      }
    };
    await expect(
      accountLifecycle(repository, failingEmail, {
        now,
        appBaseUrl: 'https://app.example.test'
      })
    ).rejects.toThrow('delivery unavailable');

    const successfulEmail: EmailService = {
      async send() {}
    };
    await expect(
      accountLifecycle(repository, successfulEmail, {
        now,
        appBaseUrl: 'https://app.example.test'
      })
    ).resolves.toMatchObject({ temporaryWarningsSent: 1 });
  });
});

class FakeJobsRepository implements JobsRepositoryPort {
  stations: StationTransition[] = [];
  retentionStations: RetentionStation[] = [];
  records = new Map<
    string,
    { voters: number; devices: number; castVotes: number; status: string }
  >();
  closedAt = new Map<string, Date>();
  temporaryPurgeDates = new Map<string, Date>();
  temporaryWarnings: { id: string; email: string; purgeAt: Date }[] = [];
  inactiveLongTermHosts: { id: string; email: string; lastLoginAt: Date | null }[] = [];
  private sentWarnings = new Set<string>();
  private markedLongTerm = new Set<string>();
  longTermPurgeDates = new Map<string, Date>();
  markedLongTermAccounts = 0;
  temporaryAccountsDue: string[] = [];
  private deletedAccounts = new Set<string>();

  async findDueTransitions(nowValue: Date, batchSize = 10): Promise<StationTransition[]> {
    return this.stations
      .filter((item) => {
        if (item.status === 'REG_OPEN') {
          return item.regEndsAt !== null && item.regEndsAt <= nowValue;
        }
        if (item.status === 'REG_CLOSED') {
          return (
            item.mode === 'CLOSED_VOTE' &&
            item.voteStartsAt !== null &&
            item.voteStartsAt <= nowValue
          );
        }
        if (item.status === 'DRAFT') {
          return (
            item.mode === 'PUBLIC_POLL' &&
            item.isLaunched &&
            item.voteStartsAt !== null &&
            item.voteStartsAt <= nowValue
          );
        }
        return (
          item.status === 'VOTE_OPEN' && item.voteEndsAt !== null && item.voteEndsAt <= nowValue
        );
      })
      .slice(0, batchSize)
      .map((item) => ({ ...item }));
  }

  async transitionDueStation(item: StationTransition, nowValue: Date): Promise<{ id: string }[]> {
    const current = this.stations.find(({ id }) => id === item.id);
    if (!current || current.status !== item.status) {
      return [];
    }
    if (current.status === 'REG_OPEN') {
      current.status = 'REG_CLOSED';
    } else if (current.status === 'REG_CLOSED' || current.status === 'DRAFT') {
      current.status = 'VOTE_OPEN';
    } else if (current.status === 'VOTE_OPEN') {
      current.status = 'VOTE_CLOSED';
      this.closedAt.set(current.id, nowValue);
    }
    return [{ id: current.id }];
  }

  async extendTemporaryPurgeAt(hostId: string, purgeAt: Date): Promise<void> {
    this.temporaryPurgeDates.set(hostId, purgeAt);
  }

  async findRetentionStations(cutoff: Date, batchSize = 10): Promise<RetentionStation[]> {
    return this.retentionStations
      .filter(
        ({ id, closedAt }) =>
          this.records.get(id)?.status === 'VOTE_CLOSED' && closedAt !== null && closedAt <= cutoff
      )
      .slice(0, batchSize);
  }

  async deleteRawVoterBatch(stationId: string, cutoff: Date, batchSize = 100): Promise<number> {
    if (!this.isEligiblePurgeStation(stationId, cutoff)) {
      return 0;
    }
    const record = this.records.get(stationId);
    if (!record) {
      return 0;
    }
    const deleted = Math.min(record.voters, batchSize);
    record.voters -= deleted;
    return deleted;
  }

  async deleteDeviceBatch(stationId: string, cutoff: Date, batchSize = 100): Promise<number> {
    if (!this.isEligiblePurgeStation(stationId, cutoff)) {
      return 0;
    }
    const record = this.records.get(stationId);
    if (!record) {
      return 0;
    }
    const deleted = Math.min(record.devices, batchSize);
    record.devices -= deleted;
    return deleted;
  }

  async hasRawStationData(stationId: string): Promise<boolean> {
    const record = this.records.get(stationId);
    return record !== undefined && (record.voters > 0 || record.devices > 0);
  }

  async archiveStation(stationId: string, cutoff: Date): Promise<boolean> {
    const record = this.records.get(stationId);
    if (
      !record ||
      record.status !== 'VOTE_CLOSED' ||
      !this.retentionStations.some(
        (stationRecord) =>
          stationRecord.id === stationId &&
          stationRecord.closedAt !== null &&
          stationRecord.closedAt <= cutoff
      )
    ) {
      return false;
    }
    record.status = 'ARCHIVED';
    return true;
  }

  async findTemporaryAccountsDue(_now: Date, batchSize = 2): Promise<{ id: string }[]> {
    return this.temporaryAccountsDue
      .filter(
        (hostId) =>
          !this.deletedAccounts.has(hostId) &&
          this.retentionStations
            .filter((stationRecord) => stationRecord.hostId === hostId)
            .every((stationRecord) => {
              const record = this.records.get(stationRecord.id);
              return (
                record === undefined ||
                record.status === 'ARCHIVED' ||
                record.status === 'CANCELLED'
              );
            })
      )
      .slice(0, batchSize)
      .map((id) => ({ id }));
  }

  private isEligiblePurgeStation(stationId: string, cutoff: Date): boolean {
    return this.retentionStations.some(
      (stationRecord) =>
        stationRecord.id === stationId &&
        stationRecord.closedAt !== null &&
        stationRecord.closedAt <= cutoff &&
        stationRecord.plan !== 'PREMIUM' &&
        (stationRecord.accountType === 'TEMPORARY' || stationRecord.plan === 'PAY_PER_USE')
    );
  }

  async deleteTemporaryAccountBatch(
    hostId: string,
    nowValue: Date
  ): Promise<{ deletedRows: number; accountDeleted: boolean }> {
    if (!(await this.findTemporaryAccountsDue(nowValue)).some(({ id }) => id === hostId)) {
      return { deletedRows: 0, accountDeleted: false };
    }
    this.deletedAccounts.add(hostId);
    return { deletedRows: 0, accountDeleted: true };
  }

  async findTemporaryWarnings(
    nowValue: Date,
    warningWindowEnd: Date,
    batchSize = 10
  ): Promise<{ id: string; email: string }[]> {
    return this.temporaryWarnings
      .filter(
        ({ id, purgeAt }) =>
          !this.sentWarnings.has(id) && purgeAt > nowValue && purgeAt <= warningWindowEnd
      )
      .slice(0, batchSize);
  }

  async claimTemporaryWarning(userId: string): Promise<boolean> {
    if (this.sentWarnings.has(userId)) {
      return false;
    }
    this.sentWarnings.add(userId);
    return true;
  }

  async findInactiveLongTermHosts(
    cutoff: Date,
    batchSize = 10
  ): Promise<{ id: string; email: string; lastLoginAt: Date | null }[]> {
    return this.inactiveLongTermHosts
      .filter(
        ({ id, lastLoginAt }) =>
          !this.sentWarnings.has(id) && lastLoginAt !== null && lastLoginAt <= cutoff
      )
      .slice(0, batchSize);
  }

  async claimLongTermWarning(
    userId: string,
    lastLoginAt: Date,
    cutoff: Date,
    nowValue: Date
  ): Promise<boolean> {
    const host = this.inactiveLongTermHosts.find(({ id }) => id === userId);
    if (
      !host ||
      host.lastLoginAt?.getTime() !== lastLoginAt.getTime() ||
      lastLoginAt > cutoff ||
      nowValue < lastLoginAt
    ) {
      return false;
    }
    if (this.sentWarnings.has(userId)) {
      return false;
    }
    this.sentWarnings.add(userId);
    return true;
  }

  async releaseWarningClaim(userId: string): Promise<void> {
    this.sentWarnings.delete(userId);
  }

  async markInactiveLongTermHosts(cutoff: Date): Promise<number> {
    const eligible = this.inactiveLongTermHosts.filter(
      ({ id, lastLoginAt }) =>
        lastLoginAt !== null && lastLoginAt <= cutoff && !this.markedLongTerm.has(id)
    );
    for (const host of eligible) {
      this.markedLongTerm.add(host.id);
      if (host.lastLoginAt) {
        this.longTermPurgeDates.set(host.id, addUtcMonths(host.lastLoginAt, 6));
      }
    }
    this.markedLongTermAccounts += eligible.length;
    return eligible.length;
  }
}

function station(id: string, overrides: Partial<StationTransition>): StationTransition {
  return {
    id,
    hostId: 'host',
    status: 'VOTE_OPEN',
    mode: 'CLOSED_VOTE',
    isLaunched: true,
    regEndsAt: null,
    voteStartsAt: null,
    voteEndsAt: null,
    ...overrides
  };
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
