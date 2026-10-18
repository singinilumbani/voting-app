import type {
  candidates,
  categories,
  deviceRecords,
  pollingStations,
  registeredVoters
} from '../db/schema/index.js';

export type VotingStation = typeof pollingStations.$inferSelect;
export type VotingVoter = typeof registeredVoters.$inferSelect;
export type VotingCategory = typeof categories.$inferSelect;
export type VotingCandidate = typeof candidates.$inferSelect;
export type VotingDevice = typeof deviceRecords.$inferSelect;

export interface VotingRepositoryPort {
  withTransaction<T>(operation: (repository: VotingRepositoryPort) => Promise<T>): Promise<T>;
  findStation(publicId: string, forUpdate?: boolean): Promise<VotingStation | undefined>;
  findVoterByTokenHash(stationId: string, tokenHash: string): Promise<VotingVoter | undefined>;
  findVoterByPhone(
    stationId: string,
    phoneNumber: string,
    forUpdate?: boolean
  ): Promise<VotingVoter | undefined>;
  findVoter(
    stationId: string,
    voterId: string,
    forUpdate?: boolean
  ): Promise<VotingVoter | undefined>;
  updateVoter(
    voterId: string,
    values: Partial<typeof registeredVoters.$inferInsert>
  ): Promise<VotingVoter | undefined>;
  listCategories(stationId: string): Promise<VotingCategory[]>;
  listCandidates(stationId: string): Promise<VotingCandidate[]>;
  insertVotes(
    stationId: string,
    selections: Array<{ categoryId: string; candidateId: string | null }>
  ): Promise<void>;
  findDevice(
    stationId: string,
    deviceUuid: string,
    forUpdate?: boolean
  ): Promise<VotingDevice | undefined>;
  insertDevice(values: typeof deviceRecords.$inferInsert): Promise<VotingDevice | undefined>;
  updateDevice(
    deviceId: string,
    values: Partial<typeof deviceRecords.$inferInsert>
  ): Promise<VotingDevice | undefined>;
  countVotedDevices(stationId: string): Promise<number>;
  listResults(
    stationId: string
  ): Promise<Array<{ categoryId: string; candidateId: string | null; count: number }>>;
}
