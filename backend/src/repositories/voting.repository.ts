import { and, count, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient, DbTransaction, DatabaseExecutor } from '../db/client.js';
import {
  candidates,
  castVotes,
  categories,
  deviceRecords,
  pollingStations,
  registeredVoters
} from '../db/schema/index.js';
import type { VotingRepositoryPort } from '../services/voting.repository.js';

export class VotingRepository extends BaseRepository implements VotingRepositoryPort {
  private constructor(
    db: DatabaseExecutor,
    private readonly transaction: DbClient['withTransaction']
  ) {
    super(db);
  }

  static fromClient(client: DbClient): VotingRepository {
    return new VotingRepository(client.db, client.withTransaction);
  }

  withTransaction<T>(operation: (repository: VotingRepositoryPort) => Promise<T>): Promise<T> {
    return this.transaction((transaction: DbTransaction) =>
      operation(new VotingRepository(transaction, this.transaction))
    );
  }

  findStation(publicId: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(pollingStations)
      .where(eq(pollingStations.publicId, publicId))
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  findVoterByTokenHash(stationId: string, tokenHash: string) {
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

  findVoterByPhone(stationId: string, phoneNumber: string, forUpdate = false) {
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

  updateVoter(voterId: string, values: Partial<typeof registeredVoters.$inferInsert>) {
    return this.first(
      this.db
        .update(registeredVoters)
        .set(values)
        .where(eq(registeredVoters.id, voterId))
        .returning()
    );
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
      .orderBy(candidates.id)
      .then((rows) => rows.map(({ candidate }) => candidate));
  }

  async insertVotes(
    stationId: string,
    selections: Array<{ categoryId: string; candidateId: string | null }>
  ): Promise<void> {
    await this.db.insert(castVotes).values(
      selections.map((selection) => ({
        id: crypto.randomUUID(),
        pollingStationId: stationId,
        categoryId: selection.categoryId,
        candidateId: selection.candidateId
      }))
    );
  }

  findDevice(stationId: string, deviceUuid: string, forUpdate = false) {
    const query = this.db
      .select()
      .from(deviceRecords)
      .where(
        and(
          eq(deviceRecords.pollingStationId, stationId),
          eq(deviceRecords.clientDeviceUuid, deviceUuid)
        )
      )
      .limit(1);
    return this.first(forUpdate ? query.for('update') : query);
  }

  insertDevice(values: typeof deviceRecords.$inferInsert) {
    return this.first(this.db.insert(deviceRecords).values(values).returning());
  }

  updateDevice(deviceId: string, values: Partial<typeof deviceRecords.$inferInsert>) {
    return this.first(
      this.db.update(deviceRecords).set(values).where(eq(deviceRecords.id, deviceId)).returning()
    );
  }

  async countVotedDevices(stationId: string): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(deviceRecords)
      .where(and(eq(deviceRecords.pollingStationId, stationId), eq(deviceRecords.hasVoted, true)));
    return result?.value ?? 0;
  }

  listResults(stationId: string) {
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
}
