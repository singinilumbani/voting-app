import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient, DatabaseExecutor } from '../db/client.js';
import { activityLog, castVotes, pollingStations, registeredVoters } from '../db/schema/index.js';
import type { VoterInsert, VoterRepositoryPort } from '../services/voter.repository.js';

export class VoterRepository extends BaseRepository implements VoterRepositoryPort {
  private constructor(
    db: DatabaseExecutor,
    private readonly transaction: DbClient['withTransaction']
  ) {
    super(db);
  }

  static fromClient(client: DbClient): VoterRepository {
    return new VoterRepository(client.db, client.withTransaction);
  }

  withTransaction<T>(operation: (repository: VoterRepositoryPort) => Promise<T>): Promise<T> {
    return this.transaction((transaction) =>
      operation(new VoterRepository(transaction, this.transaction))
    );
  }

  findPublicStation(publicId: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(pollingStations)
      .where(eq(pollingStations.publicId, publicId))
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  findOwnedStation(hostId: string, stationId: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(pollingStations)
      .where(and(eq(pollingStations.id, stationId), eq(pollingStations.hostId, hostId)))
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  findByPhone(stationId: string, phoneNumber: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          eq(registeredVoters.phoneNumber, phoneNumber)
        )
      )
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  findByTokenHash(stationId: string, tokenHash: string) {
    return this.first(
      this.db
        .select()
        .from(registeredVoters)
        .where(
          and(
            eq(registeredVoters.pollingStationId, stationId),
            eq(registeredVoters.tokenHash, tokenHash)
          )
        )
        .limit(1)
    );
  }

  findVoter(stationId: string, voterId: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(registeredVoters)
      .where(
        and(eq(registeredVoters.pollingStationId, stationId), eq(registeredVoters.id, voterId))
      )
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  async countCapacityRegistrations(stationId: string): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          inArray(registeredVoters.approvalStatus, ['PENDING', 'APPROVED'])
        )
      );
    return result?.value ?? 0;
  }

  createVoter(values: VoterInsert) {
    return this.first(this.db.insert(registeredVoters).values(values).returning());
  }

  updateVoter(voterId: string, values: Partial<VoterInsert>) {
    return this.first(
      this.db
        .update(registeredVoters)
        .set(values)
        .where(eq(registeredVoters.id, voterId))
        .returning()
    );
  }

  listVoters(stationId: string) {
    return this.db
      .select({
        id: registeredVoters.id,
        fullName: registeredVoters.fullName,
        phoneNumber: registeredVoters.phoneNumber,
        approvalStatus: registeredVoters.approvalStatus,
        rejectionReason: registeredVoters.rejectionReason,
        blocked: registeredVoters.blocked,
        deviceFingerprintHash: registeredVoters.deviceFingerprintHash,
        clientDeviceUuid: registeredVoters.clientDeviceUuid,
        registeredAt: registeredVoters.registeredAt,
        approvedAt: registeredVoters.approvedAt,
        hasVoted: registeredVoters.hasVoted
      })
      .from(registeredVoters)
      .where(eq(registeredVoters.pollingStationId, stationId))
      .orderBy(sql`${registeredVoters.registeredAt} DESC`);
  }

  async listPendingVoterIds(stationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: registeredVoters.id })
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          eq(registeredVoters.approvalStatus, 'PENDING')
        )
      );
    return rows.map(({ id }) => id);
  }

  async countVoters(stationId: string) {
    const [result] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${registeredVoters.approvalStatus} = 'PENDING')::int`,
        approved: sql<number>`count(*) filter (where ${registeredVoters.approvalStatus} = 'APPROVED')::int`,
        rejected: sql<number>`count(*) filter (where ${registeredVoters.approvalStatus} = 'REJECTED')::int`,
        revoked: sql<number>`count(*) filter (where ${registeredVoters.approvalStatus} = 'REVOKED')::int`,
        voted: sql<number>`count(*) filter (where ${registeredVoters.hasVoted})::int`
      })
      .from(registeredVoters)
      .where(eq(registeredVoters.pollingStationId, stationId));
    return {
      pending: result?.pending ?? 0,
      approved: result?.approved ?? 0,
      rejected: result?.rejected ?? 0,
      revoked: result?.revoked ?? 0,
      voted: result?.voted ?? 0
    };
  }

  async voterIntegrity(stationId: string) {
    const [approved] = await this.db
      .select({ value: count() })
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          eq(registeredVoters.approvalStatus, 'APPROVED')
        )
      );
    const [ballots] = await this.db
      .select({ value: count() })
      .from(registeredVoters)
      .where(
        and(eq(registeredVoters.pollingStationId, stationId), eq(registeredVoters.hasVoted, true))
      );
    const [abstentions] = await this.db
      .select({ value: count() })
      .from(castVotes)
      .where(and(eq(castVotes.pollingStationId, stationId), isNull(castVotes.candidateId)));
    return {
      approvedVoters: approved?.value ?? 0,
      ballotsCast: ballots?.value ?? 0,
      abstentions: abstentions?.value ?? 0
    };
  }

  async addActivity(values: typeof activityLog.$inferInsert): Promise<void> {
    await this.db.insert(activityLog).values(values);
  }
}
