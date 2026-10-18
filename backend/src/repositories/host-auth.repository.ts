import { and, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import type { DbClient, DatabaseExecutor } from '../db/client.js';
import {
  activityLog,
  candidates,
  castVotes,
  categories,
  deviceRecords,
  emailVerificationTokens,
  passwordResetTokens,
  payments,
  pollingStations,
  registeredVoters,
  sessions,
  users
} from '../db/schema/index.js';
import type { HostAuthRepositoryPort } from '../services/host-auth.repository.js';

export class HostAuthRepository extends BaseRepository implements HostAuthRepositoryPort {
  private constructor(
    db: DatabaseExecutor,
    private readonly transaction: DbClient['withTransaction']
  ) {
    super(db);
  }

  static fromClient(client: DbClient): HostAuthRepository {
    return new HostAuthRepository(client.db, client.withTransaction);
  }

  withTransaction<T>(operation: (repository: HostAuthRepositoryPort) => Promise<T>): Promise<T> {
    return this.transaction((transaction) =>
      operation(new HostAuthRepository(transaction, this.transaction))
    );
  }

  findUserById(id: string) {
    return this.first(this.db.select().from(users).where(eq(users.id, id)).limit(1));
  }

  findUserByUsername(username: string) {
    return this.first(this.db.select().from(users).where(eq(users.username, username)).limit(1));
  }

  findUserByEmail(email: string) {
    return this.first(this.db.select().from(users).where(eq(users.email, email)).limit(1));
  }

  createUser(values: typeof users.$inferInsert) {
    return this.first(this.db.insert(users).values(values).returning());
  }

  updateUser(id: string, values: Partial<typeof users.$inferInsert>) {
    return this.first(this.db.update(users).set(values).where(eq(users.id, id)).returning());
  }

  createSession(values: typeof sessions.$inferInsert) {
    return this.first(this.db.insert(sessions).values(values).returning());
  }

  async findSessionWithUser(tokenHash: string, now: Date) {
    const [record] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now), isNull(sessions.usedAt))
      )
      .limit(1);
    return record;
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.db.update(sessions).set({ usedAt: now }).where(eq(sessions.id, sessionId));
  }

  createResetToken(values: typeof passwordResetTokens.$inferInsert) {
    return this.first(this.db.insert(passwordResetTokens).values(values).returning());
  }

  findUsableResetToken(tokenHash: string, now: Date) {
    return this.first(
      this.db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            gt(passwordResetTokens.expiresAt, now),
            isNull(passwordResetTokens.usedAt)
          )
        )
        .limit(1)
    );
  }

  markResetTokenUsed(id: string, now: Date) {
    return this.first(
      this.db
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
        .returning()
    );
  }

  async deleteResetTokensForUser(userId: string): Promise<void> {
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }

  createVerificationToken(values: typeof emailVerificationTokens.$inferInsert) {
    return this.first(this.db.insert(emailVerificationTokens).values(values).returning());
  }

  findUsableVerificationToken(tokenHash: string, now: Date) {
    return this.first(
      this.db
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.tokenHash, tokenHash),
            gt(emailVerificationTokens.expiresAt, now),
            isNull(emailVerificationTokens.usedAt)
          )
        )
        .limit(1)
    );
  }

  async findVerificationTokenWithUser(tokenHash: string, now: Date) {
    const [record] = await this.db
      .select({ token: emailVerificationTokens, user: users })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(emailVerificationTokens.userId, users.id))
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          gt(emailVerificationTokens.expiresAt, now),
          isNull(emailVerificationTokens.usedAt)
        )
      )
      .limit(1);
    return record;
  }

  markVerificationTokenUsed(id: string, now: Date) {
    return this.first(
      this.db
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(and(eq(emailVerificationTokens.id, id), isNull(emailVerificationTokens.usedAt)))
        .returning()
    );
  }

  async deleteVerificationTokensForUser(userId: string): Promise<void> {
    await this.db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async deleteSessionsForUserExcept(userId: string, sessionId: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.id, sessionId)));
  }

  async exportAccount(hostId: string): Promise<Record<string, unknown> | undefined> {
    const user = await this.findUserById(hostId);
    if (!user) {
      return undefined;
    }
    const stations = await this.db
      .select()
      .from(pollingStations)
      .where(eq(pollingStations.hostId, hostId));
    const stationIds = stations.map((station) => station.id);
    const stationCategories = stationIds.length
      ? await this.db
          .select()
          .from(categories)
          .where(inArray(categories.pollingStationId, stationIds))
      : [];
    const categoryIds = stationCategories.map((category) => category.id);
    const [stationCandidates, voters, devices, votes, logs, hostPayments] = await Promise.all([
      categoryIds.length
        ? this.db.select().from(candidates).where(inArray(candidates.categoryId, categoryIds))
        : Promise.resolve([]),
      stationIds.length
        ? this.db
            .select()
            .from(registeredVoters)
            .where(inArray(registeredVoters.pollingStationId, stationIds))
        : Promise.resolve([]),
      stationIds.length
        ? this.db
            .select()
            .from(deviceRecords)
            .where(inArray(deviceRecords.pollingStationId, stationIds))
        : Promise.resolve([]),
      stationIds.length
        ? this.db.select().from(castVotes).where(inArray(castVotes.pollingStationId, stationIds))
        : Promise.resolve([]),
      stationIds.length
        ? this.db
            .select()
            .from(activityLog)
            .where(inArray(activityLog.pollingStationId, stationIds))
        : Promise.resolve([]),
      this.db.select().from(payments).where(eq(payments.hostId, hostId))
    ]);

    const profile: Record<string, unknown> = { ...user };
    delete profile.passwordHash;
    return {
      profile,
      pollingStations: stations,
      categories: stationCategories,
      candidates: stationCandidates,
      registeredVoters: voters,
      deviceRecords: devices,
      castVotes: votes,
      activityLog: logs,
      payments: hostPayments
    };
  }

  async deleteAccount(hostId: string): Promise<boolean> {
    return this.transaction(async (transaction) => {
      const transactionRepository = new HostAuthRepository(transaction, this.transaction);
      const user = await transactionRepository.findUserById(hostId);
      if (!user) {
        return false;
      }

      const ownedStations = await transactionRepository.db
        .select({ id: pollingStations.id })
        .from(pollingStations)
        .where(eq(pollingStations.hostId, hostId));
      const stationIds = ownedStations.map((station) => station.id);
      const ownedCategories = stationIds.length
        ? await transactionRepository.db
            .select({ id: categories.id })
            .from(categories)
            .where(inArray(categories.pollingStationId, stationIds))
        : [];
      const categoryIds = ownedCategories.map((category) => category.id);

      await transactionRepository.db
        .update(activityLog)
        .set({ actorUserId: null })
        .where(eq(activityLog.actorUserId, hostId));
      await transactionRepository.db.delete(payments).where(eq(payments.hostId, hostId));

      if (stationIds.length) {
        await transactionRepository.db
          .delete(activityLog)
          .where(inArray(activityLog.pollingStationId, stationIds));
        await transactionRepository.db
          .delete(castVotes)
          .where(inArray(castVotes.pollingStationId, stationIds));
        await transactionRepository.db
          .delete(registeredVoters)
          .where(inArray(registeredVoters.pollingStationId, stationIds));
        await transactionRepository.db
          .delete(deviceRecords)
          .where(inArray(deviceRecords.pollingStationId, stationIds));
      }
      if (categoryIds.length) {
        await transactionRepository.db
          .delete(candidates)
          .where(inArray(candidates.categoryId, categoryIds));
        await transactionRepository.db
          .delete(categories)
          .where(inArray(categories.id, categoryIds));
      }
      if (stationIds.length) {
        await transactionRepository.db
          .delete(pollingStations)
          .where(inArray(pollingStations.id, stationIds));
      }

      await transactionRepository.db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, hostId));
      await transactionRepository.db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, hostId));
      await transactionRepository.db.delete(sessions).where(eq(sessions.userId, hostId));
      await transactionRepository.db.delete(users).where(eq(users.id, hostId));
      return true;
    });
  }
}
