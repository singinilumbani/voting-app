import type {
  accountTypeEnum,
  planEnum,
  stationModeEnum,
  stationStatusEnum
} from '../../db/schema/enums.js';

type AccountType = (typeof accountTypeEnum.enumValues)[number];
type Plan = (typeof planEnum.enumValues)[number];
type StationMode = (typeof stationModeEnum.enumValues)[number];
type StationStatus = (typeof stationStatusEnum.enumValues)[number];

export interface StationTransition {
  id: string;
  hostId: string;
  status: StationStatus;
  mode: StationMode;
  isLaunched: boolean;
  regEndsAt: Date | null;
  voteStartsAt: Date | null;
  voteEndsAt: Date | null;
}

export interface RetentionStation {
  id: string;
  hostId: string;
  accountType: AccountType;
  plan: Plan;
  closedAt: Date | null;
}

export interface JobsRepositoryPort {
  findDueTransitions(now: Date, batchSize?: number): Promise<StationTransition[]>;
  transitionDueStation(station: StationTransition, now: Date): Promise<{ id: string }[]>;
  extendTemporaryPurgeAt(hostId: string, purgeAt: Date): Promise<void>;
  findRetentionStations(cutoff: Date, batchSize?: number): Promise<RetentionStation[]>;
  deleteRawVoterBatch(stationId: string, cutoff: Date, batchSize?: number): Promise<number>;
  deleteDeviceBatch(stationId: string, cutoff: Date, batchSize?: number): Promise<number>;
  hasRawStationData(stationId: string): Promise<boolean>;
  archiveStation(stationId: string, cutoff: Date): Promise<boolean>;
  findTemporaryAccountsDue(now: Date, batchSize?: number): Promise<{ id: string }[]>;
  deleteTemporaryAccountBatch(
    hostId: string,
    now: Date,
    batchSize?: number
  ): Promise<{ deletedRows: number; accountDeleted: boolean }>;
  findTemporaryWarnings(
    now: Date,
    warningWindowEnd: Date,
    batchSize?: number
  ): Promise<{ id: string; email: string }[]>;
  claimTemporaryWarning(userId: string, now: Date): Promise<boolean>;
  findInactiveLongTermHosts(
    cutoff: Date,
    batchSize?: number
  ): Promise<{ id: string; email: string; lastLoginAt: Date | null }[]>;
  claimLongTermWarning(
    userId: string,
    lastLoginAt: Date,
    cutoff: Date,
    now: Date
  ): Promise<boolean>;
  releaseWarningClaim(userId: string, claimedAt: Date): Promise<void>;
  markInactiveLongTermHosts(cutoff: Date): Promise<number>;
}

export interface JobClockOptions {
  now?: Date;
  batchSize?: number;
}

export interface StationTickOptions extends JobClockOptions {
  retentionDays: number;
}

export interface RetentionPurgeOptions extends JobClockOptions {
  retentionDays: number;
  accountBatchSize?: number;
}

export interface AccountLifecycleOptions extends JobClockOptions {
  appBaseUrl: string;
}
