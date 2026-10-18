import type { EmailService } from '../../services/email.service.js';
import type {
  AccountLifecycleOptions,
  JobsRepositoryPort,
  RetentionPurgeOptions,
  StationTickOptions
} from './jobs.types.js';

const DEFAULT_BATCH_SIZE = 10;
const RECORD_BATCH_SIZE = 100;
const ACCOUNT_BATCH_SIZE = 2;

export interface StationTickResult {
  registrationsClosed: number;
  votingOpened: number;
  votingClosed: number;
}

export interface RetentionPurgeResult {
  voterRecordsDeleted: number;
  deviceRecordsDeleted: number;
  stationsArchived: number;
  accountsDeleted: number;
}

export interface AccountLifecycleResult {
  temporaryWarningsSent: number;
  inactivityWarningsSent: number;
  longTermAccountsMarked: number;
}

export async function stationTick(
  repository: JobsRepositoryPort,
  options: StationTickOptions
): Promise<StationTickResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: StationTickResult = {
    registrationsClosed: 0,
    votingOpened: 0,
    votingClosed: 0
  };

  for (const station of await repository.findDueTransitions(now, batchSize)) {
    const transitioned = await repository.transitionDueStation(station, now);
    if (transitioned.length === 0) {
      continue;
    }

    if (station.status === 'REG_OPEN') {
      result.registrationsClosed += 1;
    } else if (station.status === 'VOTE_OPEN') {
      result.votingClosed += 1;
      await repository.extendTemporaryPurgeAt(station.hostId, addDays(now, options.retentionDays));
    } else {
      result.votingOpened += 1;
    }
  }

  return result;
}

export async function retentionPurge(
  repository: JobsRepositoryPort,
  options: RetentionPurgeOptions
): Promise<RetentionPurgeResult> {
  const now = options.now ?? new Date();
  const cutoff = addDays(now, -options.retentionDays);
  const result: RetentionPurgeResult = {
    voterRecordsDeleted: 0,
    deviceRecordsDeleted: 0,
    stationsArchived: 0,
    accountsDeleted: 0
  };

  for (const station of await repository.findRetentionStations(
    cutoff,
    options.batchSize ?? DEFAULT_BATCH_SIZE
  )) {
    if (
      station.plan !== 'PREMIUM' &&
      (station.accountType === 'TEMPORARY' || station.plan === 'PAY_PER_USE')
    ) {
      result.voterRecordsDeleted += await repository.deleteRawVoterBatch(
        station.id,
        cutoff,
        RECORD_BATCH_SIZE
      );
      result.deviceRecordsDeleted += await repository.deleteDeviceBatch(
        station.id,
        cutoff,
        RECORD_BATCH_SIZE
      );
      if (await repository.hasRawStationData(station.id)) {
        continue;
      }
    }

    if (await repository.archiveStation(station.id, cutoff)) {
      result.stationsArchived += 1;
    }
  }

  for (const account of await repository.findTemporaryAccountsDue(
    now,
    options.accountBatchSize ?? ACCOUNT_BATCH_SIZE
  )) {
    const outcome = await repository.deleteTemporaryAccountBatch(
      account.id,
      now,
      RECORD_BATCH_SIZE
    );
    if (outcome.accountDeleted) {
      result.accountsDeleted += 1;
    }
  }

  return result;
}

export async function accountLifecycle(
  repository: JobsRepositoryPort,
  emailService: EmailService,
  options: AccountLifecycleOptions
): Promise<AccountLifecycleResult> {
  const now = options.now ?? new Date();
  const warningWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const fiveMonthCutoff = addUtcMonths(now, -5);
  const sixMonthCutoff = addUtcMonths(now, -6);
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: AccountLifecycleResult = {
    temporaryWarningsSent: 0,
    inactivityWarningsSent: 0,
    longTermAccountsMarked: 0
  };
  const link = new URL('/host/dashboard', options.appBaseUrl).toString();

  for (const host of await repository.findTemporaryWarnings(now, warningWindowEnd, batchSize)) {
    if (!(await repository.claimTemporaryWarning(host.id, now))) {
      continue;
    }
    try {
      await emailService.send('host.temporary_purge_warning', host.email, { link });
    } catch (error) {
      await repository.releaseWarningClaim(host.id, now);
      throw error;
    }
    result.temporaryWarningsSent += 1;
  }

  for (const host of await repository.findInactiveLongTermHosts(fiveMonthCutoff, batchSize)) {
    if (host.lastLoginAt === null) {
      continue;
    }
    if (!(await repository.claimLongTermWarning(host.id, host.lastLoginAt, fiveMonthCutoff, now))) {
      continue;
    }
    try {
      await emailService.send('host.inactivity_warning', host.email, { link });
    } catch (error) {
      await repository.releaseWarningClaim(host.id, now);
      throw error;
    }
    result.inactivityWarningsSent += 1;
  }

  result.longTermAccountsMarked = await repository.markInactiveLongTermHosts(sixMonthCutoff);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
