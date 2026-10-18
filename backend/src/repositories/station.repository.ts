import { and, asc, eq, sql } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient, DatabaseExecutor } from '../db/client.js';
import {
  activityLog,
  candidates,
  categories,
  pollingStations,
  registeredVoters
} from '../db/schema/index.js';
import type { StationRepositoryPort } from '../services/station.repository.js';

export class StationRepository extends BaseRepository implements StationRepositoryPort {
  private constructor(
    db: DatabaseExecutor,
    private readonly transaction: DbClient['withTransaction']
  ) {
    super(db);
  }

  static fromClient(client: DbClient): StationRepository {
    return new StationRepository(client.db, client.withTransaction);
  }

  withTransaction<T>(operation: (repository: StationRepositoryPort) => Promise<T>): Promise<T> {
    return this.transaction((transaction) =>
      operation(new StationRepository(transaction, this.transaction))
    );
  }

  createStation(values: typeof pollingStations.$inferInsert) {
    return this.first(this.db.insert(pollingStations).values(values).returning());
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

  findPublicStation(publicId: string) {
    return this.first(
      this.db.select().from(pollingStations).where(eq(pollingStations.publicId, publicId)).limit(1)
    );
  }

  updateStation(
    hostId: string,
    stationId: string,
    values: Partial<typeof pollingStations.$inferInsert>
  ) {
    return this.first(
      this.db
        .update(pollingStations)
        .set(values)
        .where(and(eq(pollingStations.id, stationId), eq(pollingStations.hostId, hostId)))
        .returning()
    );
  }

  listOwnedStations(hostId: string) {
    return this.db
      .select()
      .from(pollingStations)
      .where(eq(pollingStations.hostId, hostId))
      .orderBy(asc(pollingStations.createdAt));
  }

  listCategories(stationId: string) {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.pollingStationId, stationId))
      .orderBy(asc(categories.displayOrder), asc(categories.id));
  }

  createCategory(values: typeof categories.$inferInsert) {
    return this.first(this.db.insert(categories).values(values).returning());
  }

  findOwnedCategory(hostId: string, stationId: string, categoryId: string) {
    return this.first(
      this.db
        .select({ category: categories })
        .from(categories)
        .innerJoin(pollingStations, eq(categories.pollingStationId, pollingStations.id))
        .where(
          and(
            eq(categories.id, categoryId),
            eq(categories.pollingStationId, stationId),
            eq(pollingStations.hostId, hostId)
          )
        )
        .limit(1)
    ).then((result) => result?.category);
  }

  updateCategory(categoryId: string, values: Partial<typeof categories.$inferInsert>) {
    return this.first(
      this.db.update(categories).set(values).where(eq(categories.id, categoryId)).returning()
    );
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.transaction(async (transaction) => {
      await transaction.delete(candidates).where(eq(candidates.categoryId, categoryId));
      await transaction.delete(categories).where(eq(categories.id, categoryId));
    });
  }

  async listCandidates(stationId: string) {
    return this.db
      .select({ candidate: candidates })
      .from(candidates)
      .innerJoin(categories, eq(candidates.categoryId, categories.id))
      .where(eq(categories.pollingStationId, stationId))
      .orderBy(asc(candidates.createdAt))
      .then((rows) => rows.map((row) => row.candidate));
  }

  createCandidate(values: typeof candidates.$inferInsert) {
    return this.first(this.db.insert(candidates).values(values).returning());
  }

  findOwnedCandidate(hostId: string, stationId: string, candidateId: string) {
    return this.first(
      this.db
        .select({ candidate: candidates })
        .from(candidates)
        .innerJoin(categories, eq(candidates.categoryId, categories.id))
        .innerJoin(pollingStations, eq(categories.pollingStationId, pollingStations.id))
        .where(
          and(
            eq(candidates.id, candidateId),
            eq(categories.pollingStationId, stationId),
            eq(pollingStations.hostId, hostId)
          )
        )
        .limit(1)
    ).then((result) => result?.candidate);
  }

  updateCandidate(candidateId: string, values: Partial<typeof candidates.$inferInsert>) {
    return this.first(
      this.db.update(candidates).set(values).where(eq(candidates.id, candidateId)).returning()
    );
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    await this.db.delete(candidates).where(eq(candidates.id, candidateId));
  }

  async addActivity(values: typeof activityLog.$inferInsert): Promise<void> {
    await this.db.insert(activityLog).values(values);
  }

  listActivity(hostId: string, stationId: string) {
    return this.db
      .select({ activity: activityLog })
      .from(activityLog)
      .innerJoin(pollingStations, eq(activityLog.pollingStationId, pollingStations.id))
      .where(and(eq(activityLog.pollingStationId, stationId), eq(pollingStations.hostId, hostId)))
      .orderBy(sql`${activityLog.createdAt} DESC`)
      .then((rows) => rows.map((row) => row.activity));
  }

  async countPendingVoters(stationId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(registeredVoters)
      .where(
        and(
          eq(registeredVoters.pollingStationId, stationId),
          eq(registeredVoters.approvalStatus, 'PENDING')
        )
      );
    return result?.count ?? 0;
  }
}
