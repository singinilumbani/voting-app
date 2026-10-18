import { and, count, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient, DatabaseExecutor } from '../db/client.js';
import {
  candidates,
  castVotes,
  categories,
  deviceRecords,
  pollingStations,
  registeredVoters
} from '../db/schema/index.js';
import type {
  AnalyticsAuditRow,
  AnalyticsCounts,
  AnalyticsRepositoryPort
} from '../services/analytics.repository.js';

const AUDIT_EVENT_LIMIT = 500;

export class AnalyticsRepository extends BaseRepository implements AnalyticsRepositoryPort {
  private constructor(db: DatabaseExecutor) {
    super(db);
  }

  static fromClient(client: DbClient): AnalyticsRepository {
    return new AnalyticsRepository(client.db);
  }

  findOwnedStation(hostId: string, stationId: string) {
    return this.first(
      this.db
        .select()
        .from(pollingStations)
        .where(and(eq(pollingStations.id, stationId), eq(pollingStations.hostId, hostId)))
        .limit(1)
    );
  }

  async countClosedVoteBallots(stationId: string): Promise<AnalyticsCounts> {
    const [result] = await this.db
      .select({
        ballotsCast: sql<number>`count(*) filter (where ${registeredVoters.hasVoted})::int`,
        approvedVoters: sql<number>`count(*) filter (where ${registeredVoters.approvalStatus} = 'APPROVED')::int`
      })
      .from(registeredVoters)
      .where(eq(registeredVoters.pollingStationId, stationId));
    return {
      ballotsCast: result?.ballotsCast ?? 0,
      approvedVoters: result?.approvedVoters ?? 0,
      possibleDuplicates: 0
    };
  }

  async countPublicPollBallots(stationId: string): Promise<AnalyticsCounts> {
    const firstDevice = alias(deviceRecords, 'analytics_first_device');
    const secondDevice = alias(deviceRecords, 'analytics_second_device');
    const [ballots, duplicates] = await Promise.all([
      this.db
        .select({ ballotsCast: count() })
        .from(deviceRecords)
        .where(and(eq(deviceRecords.pollingStationId, stationId), eq(deviceRecords.hasVoted, true)))
        .then(([result]) => result?.ballotsCast ?? 0),
      this.db
        .select({ possibleDuplicates: sql<number>`count(DISTINCT ${secondDevice.id})::int` })
        .from(firstDevice)
        .innerJoin(
          secondDevice,
          and(
            eq(firstDevice.pollingStationId, secondDevice.pollingStationId),
            eq(firstDevice.deviceFingerprintHash, secondDevice.deviceFingerprintHash),
            sql`${firstDevice.clientDeviceUuid} < ${secondDevice.clientDeviceUuid}`
          )
        )
        .where(
          and(
            eq(firstDevice.pollingStationId, stationId),
            eq(firstDevice.hasVoted, true),
            eq(secondDevice.hasVoted, true),
            isNotNull(firstDevice.deviceFingerprintHash)
          )
        )
        .then(([result]) => result?.possibleDuplicates ?? 0)
    ]);
    return { ballotsCast: ballots, approvedVoters: null, possibleDuplicates: duplicates };
  }

  listCategories(stationId: string) {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.pollingStationId, stationId))
      .orderBy(categories.displayOrder, categories.id);
  }

  listCandidates(stationId: string) {
    return this.db
      .select({ candidate: candidates })
      .from(candidates)
      .innerJoin(categories, eq(candidates.categoryId, categories.id))
      .where(eq(categories.pollingStationId, stationId))
      .orderBy(categories.displayOrder, categories.id, candidates.name, candidates.id)
      .then((rows) => rows.map(({ candidate }) => candidate));
  }

  countVotesByCategory(stationId: string) {
    return this.db
      .select({
        categoryId: castVotes.categoryId,
        candidateId: castVotes.candidateId,
        count: sql<number>`count(*)::int`
      })
      .from(castVotes)
      .where(eq(castVotes.pollingStationId, stationId))
      .groupBy(castVotes.categoryId, castVotes.candidateId)
      .orderBy(castVotes.categoryId, castVotes.candidateId);
  }

  listAuditRows(stationId: string, limit = AUDIT_EVENT_LIMIT): Promise<AnalyticsAuditRow[]> {
    return this.db
      .select({
        voterId: registeredVoters.id,
        fullName: registeredVoters.fullName,
        votedAt: registeredVoters.votedAt
      })
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          eq(registeredVoters.hasVoted, true),
          isNotNull(registeredVoters.votedAt)
        )
      )
      .orderBy(sql`${registeredVoters.votedAt} DESC`, registeredVoters.id)
      .limit(Math.min(Math.max(1, limit), AUDIT_EVENT_LIMIT))
      .then((rows) =>
        rows.flatMap((row) =>
          row.votedAt === null
            ? []
            : [{ voterId: row.voterId, fullName: row.fullName, votedAt: row.votedAt }]
        )
      );
  }
}
