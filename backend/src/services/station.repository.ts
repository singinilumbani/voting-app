import type { activityLog } from '../db/schema/activity-log.js';
import type { candidates } from '../db/schema/candidates.js';
import type { categories } from '../db/schema/categories.js';
import type { pollingStations } from '../db/schema/polling-stations.js';

export type StationRecord = typeof pollingStations.$inferSelect;
export type CategoryRecord = typeof categories.$inferSelect;
export type CandidateRecord = typeof candidates.$inferSelect;
export type ActivityRecord = typeof activityLog.$inferSelect;

export interface StationRepositoryPort {
  withTransaction<T>(operation: (repository: StationRepositoryPort) => Promise<T>): Promise<T>;
  createStation(values: typeof pollingStations.$inferInsert): Promise<StationRecord | undefined>;
  findOwnedStation(hostId: string, stationId: string): Promise<StationRecord | undefined>;
  findPublicStation(publicId: string): Promise<StationRecord | undefined>;
  updateStation(
    hostId: string,
    stationId: string,
    values: Partial<typeof pollingStations.$inferInsert>
  ): Promise<StationRecord | undefined>;
  listOwnedStations(hostId: string): Promise<StationRecord[]>;
  listCategories(stationId: string): Promise<CategoryRecord[]>;
  createCategory(values: typeof categories.$inferInsert): Promise<CategoryRecord | undefined>;
  findOwnedCategory(
    hostId: string,
    stationId: string,
    categoryId: string
  ): Promise<CategoryRecord | undefined>;
  updateCategory(
    categoryId: string,
    values: Partial<typeof categories.$inferInsert>
  ): Promise<CategoryRecord | undefined>;
  deleteCategory(categoryId: string): Promise<void>;
  listCandidates(stationId: string): Promise<CandidateRecord[]>;
  createCandidate(values: typeof candidates.$inferInsert): Promise<CandidateRecord | undefined>;
  findOwnedCandidate(
    hostId: string,
    stationId: string,
    candidateId: string
  ): Promise<CandidateRecord | undefined>;
  updateCandidate(
    candidateId: string,
    values: Partial<typeof candidates.$inferInsert>
  ): Promise<CandidateRecord | undefined>;
  deleteCandidate(candidateId: string): Promise<void>;
  addActivity(values: typeof activityLog.$inferInsert): Promise<void>;
  listActivity(hostId: string, stationId: string): Promise<ActivityRecord[]>;
  countPendingVoters(stationId: string): Promise<number>;
}
