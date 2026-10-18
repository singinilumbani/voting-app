import type { activityLog } from '../db/schema/activity-log.js';
import type { registeredVoters } from '../db/schema/registered-voters.js';
import type { pollingStations } from '../db/schema/polling-stations.js';

export type VoterRecord = typeof registeredVoters.$inferSelect;
export type VoterInsert = typeof registeredVoters.$inferInsert;
export type VoterStationRecord = typeof pollingStations.$inferSelect;
export type VoterQueueRecord = Pick<
  VoterRecord,
  | 'id'
  | 'fullName'
  | 'phoneNumber'
  | 'approvalStatus'
  | 'rejectionReason'
  | 'blocked'
  | 'deviceFingerprintHash'
  | 'clientDeviceUuid'
  | 'registeredAt'
  | 'approvedAt'
  | 'hasVoted'
>;

export interface VoterCounts {
  pending: number;
  approved: number;
  rejected: number;
  revoked: number;
  voted: number;
}

export interface VoterIntegrity {
  approvedVoters: number;
  ballotsCast: number;
  abstentions: number;
}

export interface VoterRepositoryPort {
  withTransaction<T>(operation: (repository: VoterRepositoryPort) => Promise<T>): Promise<T>;
  findPublicStation(publicId: string, forUpdate?: boolean): Promise<VoterStationRecord | undefined>;
  findOwnedStation(
    hostId: string,
    stationId: string,
    forUpdate?: boolean
  ): Promise<VoterStationRecord | undefined>;
  findByPhone(
    stationId: string,
    phoneNumber: string,
    forUpdate?: boolean
  ): Promise<VoterRecord | undefined>;
  findByTokenHash(stationId: string, tokenHash: string): Promise<VoterRecord | undefined>;
  findVoter(
    stationId: string,
    voterId: string,
    forUpdate?: boolean
  ): Promise<VoterRecord | undefined>;
  countCapacityRegistrations(stationId: string): Promise<number>;
  createVoter(values: VoterInsert): Promise<VoterRecord | undefined>;
  updateVoter(voterId: string, values: Partial<VoterInsert>): Promise<VoterRecord | undefined>;
  listVoters(stationId: string): Promise<VoterQueueRecord[]>;
  listPendingVoterIds(stationId: string): Promise<string[]>;
  countVoters(stationId: string): Promise<VoterCounts>;
  voterIntegrity(stationId: string): Promise<VoterIntegrity>;
  addActivity(values: typeof activityLog.$inferInsert): Promise<void>;
}
