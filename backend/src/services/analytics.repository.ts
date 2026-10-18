import type { candidates, categories, pollingStations } from '../db/schema/index.js';

export type AnalyticsStation = typeof pollingStations.$inferSelect;
export type AnalyticsCategory = typeof categories.$inferSelect;
export type AnalyticsCandidate = typeof candidates.$inferSelect;

export interface AnalyticsCounts {
  ballotsCast: number;
  approvedVoters: number | null;
  possibleDuplicates: number;
}

export interface AnalyticsVoteCount {
  categoryId: string;
  candidateId: string | null;
  count: number;
}

export interface AnalyticsAuditRow {
  voterId: string;
  fullName: string;
  votedAt: Date;
}

export interface AnalyticsRepositoryPort {
  findOwnedStation(hostId: string, stationId: string): Promise<AnalyticsStation | undefined>;
  countClosedVoteBallots(stationId: string): Promise<AnalyticsCounts>;
  countPublicPollBallots(stationId: string): Promise<AnalyticsCounts>;
  listCategories(stationId: string): Promise<AnalyticsCategory[]>;
  listCandidates(stationId: string): Promise<AnalyticsCandidate[]>;
  countVotesByCategory(stationId: string): Promise<AnalyticsVoteCount[]>;
  listAuditRows(stationId: string, limit: number): Promise<AnalyticsAuditRow[]>;
}

export interface AnalyticsLeaderboardCandidate {
  candidateId: string;
  name: string;
  imageUrl: string | null;
  count: number;
  percentage: number;
  isLeader: boolean;
  isTie: boolean;
}

export interface AnalyticsCategoryLeaderboard {
  categoryId: string;
  title: string;
  candidates: AnalyticsLeaderboardCandidate[];
  abstentions: number;
}

export interface AnalyticsSnapshot {
  stationId: string;
  stationName: string;
  stationMode: AnalyticsStation['mode'];
  status: AnalyticsStation['status'];
  state: 'WAITING' | 'LIVE' | 'FINAL';
  ballotsCast: number;
  approvedVoters: number | null;
  turnoutPercent: number | null;
  possibleDuplicates: number;
  timeRemainingSeconds: number | null;
  categories: AnalyticsCategoryLeaderboard[];
  abstentions: number;
  lastUpdated: string;
}

export interface AnalyticsSnapshotCache {
  get(stationId: string, now: number): AnalyticsSnapshot | undefined;
  set(stationId: string, snapshot: AnalyticsSnapshot, now: number): void;
}

export class InMemoryAnalyticsSnapshotCache implements AnalyticsSnapshotCache {
  private readonly entries = new Map<
    string,
    { snapshot: AnalyticsSnapshot; expiresAt: number; touchedAt: number }
  >();

  constructor(
    private readonly ttlMs = 2_000,
    private readonly maxEntries = 1_000
  ) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw new RangeError('Analytics cache TTL must be a positive safe integer');
    }
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('Analytics cache size must be a positive safe integer');
    }
  }

  get(stationId: string, now: number): AnalyticsSnapshot | undefined {
    const entry = this.entries.get(stationId);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(stationId);
      return undefined;
    }
    entry.touchedAt = now;
    return entry.snapshot;
  }

  set(stationId: string, snapshot: AnalyticsSnapshot, now: number): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(stationId)) {
      for (const [key, entry] of this.entries) {
        if (entry.expiresAt <= now) this.entries.delete(key);
      }
      if (this.entries.size >= this.maxEntries) {
        let oldestKey: string | undefined;
        let oldestTime = Number.POSITIVE_INFINITY;
        for (const [key, entry] of this.entries) {
          if (entry.touchedAt < oldestTime) {
            oldestKey = key;
            oldestTime = entry.touchedAt;
          }
        }
        if (oldestKey !== undefined) this.entries.delete(oldestKey);
      }
    }
    this.entries.set(stationId, {
      snapshot,
      expiresAt: now + this.ttlMs,
      touchedAt: now
    });
  }
}
