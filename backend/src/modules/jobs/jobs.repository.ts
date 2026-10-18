import { and, asc, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { BaseRepository } from '../../db/base.repository.js';
import type { DbClient, DatabaseExecutor } from '../../db/client.js';
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
} from '../../db/schema/index.js';
import type { JobsRepositoryPort, RetentionStation, StationTransition } from './jobs.types.js';

const DEFAULT_BATCH_SIZE = 25;
const DELETE_BATCH_SIZE = 100;

export class JobsRepository extends BaseRepository implements JobsRepositoryPort {
  private constructor(
    db: DatabaseExecutor,
    private readonly transaction: DbClient['withTransaction']
  ) {
    super(db);
  }

  static fromClient(client: DbClient): JobsRepository {
    return new JobsRepository(client.db, client.withTransaction);
  }

  async findDueTransitions(
    now: Date,
    batchSize = DEFAULT_BATCH_SIZE
  ): Promise<StationTransition[]> {
    return this.db
      .select({
        id: pollingStations.id,
        hostId: pollingStations.hostId,
        status: pollingStations.status,
        mode: pollingStations.mode,
        isLaunched: pollingStations.isLaunched,
        regEndsAt: pollingStations.regEndsAt,
        voteStartsAt: pollingStations.voteStartsAt,
        voteEndsAt: pollingStations.voteEndsAt
      })
      .from(pollingStations)
      .where(
        or(
          and(
            eq(pollingStations.mode, 'CLOSED_VOTE'),
            eq(pollingStations.status, 'REG_OPEN'),
            lte(pollingStations.regEndsAt, now)
          ),
          and(
            eq(pollingStations.mode, 'CLOSED_VOTE'),
            eq(pollingStations.status, 'REG_CLOSED'),
            lte(pollingStations.voteStartsAt, now)
          ),
          and(
            eq(pollingStations.mode, 'PUBLIC_POLL'),
            eq(pollingStations.status, 'DRAFT'),
            eq(pollingStations.isLaunched, true),
            lte(pollingStations.voteStartsAt, now)
          ),
          and(eq(pollingStations.status, 'VOTE_OPEN'), lte(pollingStations.voteEndsAt, now))
        )
      )
      .orderBy(asc(pollingStations.id))
      .limit(batchSize);
  }

  transitionDueStation(station: StationTransition, now: Date): Promise<{ id: string }[]> {
    const commonConditions = [eq(pollingStations.id, station.id)];
    if (station.status === 'REG_OPEN') {
      return this.db
        .update(pollingStations)
        .set({ status: 'REG_CLOSED' })
        .where(
          and(
            ...commonConditions,
            eq(pollingStations.mode, 'CLOSED_VOTE'),
            eq(pollingStations.status, 'REG_OPEN'),
            lte(pollingStations.regEndsAt, now)
          )
        )
        .returning({ id: pollingStations.id });
    }

    if (station.status === 'REG_CLOSED') {
      return this.db
        .update(pollingStations)
        .set({ status: 'VOTE_OPEN' })
        .where(
          and(
            ...commonConditions,
            eq(pollingStations.mode, 'CLOSED_VOTE'),
            eq(pollingStations.status, 'REG_CLOSED'),
            lte(pollingStations.voteStartsAt, now)
          )
        )
        .returning({ id: pollingStations.id });
    }

    if (station.status === 'DRAFT') {
      return this.db
        .update(pollingStations)
        .set({ status: 'VOTE_OPEN' })
        .where(
          and(
            ...commonConditions,
            eq(pollingStations.mode, 'PUBLIC_POLL'),
            eq(pollingStations.status, 'DRAFT'),
            eq(pollingStations.isLaunched, true),
            lte(pollingStations.voteStartsAt, now)
          )
        )
        .returning({ id: pollingStations.id });
    }

    return this.db
      .update(pollingStations)
      .set({ status: 'VOTE_CLOSED', closedAt: now })
      .where(
        and(
          ...commonConditions,
          eq(pollingStations.status, 'VOTE_OPEN'),
          lte(pollingStations.voteEndsAt, now)
        )
      )
      .returning({ id: pollingStations.id });
  }

  async extendTemporaryPurgeAt(hostId: string, purgeAt: Date): Promise<void> {
    await this.db
      .update(users)
      .set({
        purgeAt: sql`GREATEST(COALESCE(${users.purgeAt}, ${purgeAt}), ${purgeAt})`,
        inactivityWarningSentAt: null
      })
      .where(and(eq(users.id, hostId), eq(users.accountType, 'TEMPORARY')));
  }

  async findRetentionStations(
    cutoff: Date,
    batchSize = DEFAULT_BATCH_SIZE
  ): Promise<RetentionStation[]> {
    return this.db
      .select({
        id: pollingStations.id,
        hostId: pollingStations.hostId,
        accountType: users.accountType,
        plan: users.plan,
        closedAt: pollingStations.closedAt
      })
      .from(pollingStations)
      .innerJoin(users, eq(users.id, pollingStations.hostId))
      .where(and(eq(pollingStations.status, 'VOTE_CLOSED'), lte(pollingStations.closedAt, cutoff)))
      .orderBy(asc(pollingStations.closedAt), asc(pollingStations.id))
      .limit(batchSize);
  }

  async deleteRawVoterBatch(
    stationId: string,
    cutoff: Date,
    batchSize = DELETE_BATCH_SIZE
  ): Promise<number> {
    const eligibleStation = this.eligiblePurgeStation(stationId, cutoff);
    const deleted = await this.db
      .delete(registeredVoters)
      .where(
        and(
          inArray(registeredVoters.pollingStationId, eligibleStation),
          inArray(
            registeredVoters.id,
            this.db
              .select({ id: registeredVoters.id })
              .from(registeredVoters)
              .where(eq(registeredVoters.pollingStationId, stationId))
              .limit(batchSize)
          )
        )
      )
      .returning({ id: registeredVoters.id });
    return deleted.length;
  }

  async deleteDeviceBatch(
    stationId: string,
    cutoff: Date,
    batchSize = DELETE_BATCH_SIZE
  ): Promise<number> {
    const eligibleStation = this.eligiblePurgeStation(stationId, cutoff);
    const deleted = await this.db
      .delete(deviceRecords)
      .where(
        and(
          inArray(deviceRecords.pollingStationId, eligibleStation),
          inArray(
            deviceRecords.id,
            this.db
              .select({ id: deviceRecords.id })
              .from(deviceRecords)
              .where(eq(deviceRecords.pollingStationId, stationId))
              .limit(batchSize)
          )
        )
      )
      .returning({ id: deviceRecords.id });
    return deleted.length;
  }

  async hasRawStationData(stationId: string): Promise<boolean> {
    const [voter] = await this.db
      .select({ id: registeredVoters.id })
      .from(registeredVoters)
      .where(eq(registeredVoters.pollingStationId, stationId))
      .limit(1);
    if (voter) {
      return true;
    }
    const [device] = await this.db
      .select({ id: deviceRecords.id })
      .from(deviceRecords)
      .where(eq(deviceRecords.pollingStationId, stationId))
      .limit(1);
    return device !== undefined;
  }

  async archiveStation(stationId: string, cutoff: Date): Promise<boolean> {
    const archived = await this.db
      .update(pollingStations)
      .set({ status: 'ARCHIVED' })
      .where(
        and(
          eq(pollingStations.id, stationId),
          eq(pollingStations.status, 'VOTE_CLOSED'),
          lte(pollingStations.closedAt, cutoff)
        )
      )
      .returning({ id: pollingStations.id });
    return archived.length > 0;
  }

  async findTemporaryAccountsDue(now: Date, batchSize = 5) {
    return this.db
      .select({
        id: users.id
      })
      .from(users)
      .where(
        and(
          eq(users.accountType, 'TEMPORARY'),
          lte(users.purgeAt, now),
          sql`NOT EXISTS (
            SELECT 1 FROM polling_stations
            WHERE polling_stations.host_id = ${users.id}
              AND polling_stations.status NOT IN ('ARCHIVED', 'CANCELLED')
          )`
        )
      )
      .orderBy(asc(users.purgeAt), asc(users.id))
      .limit(batchSize);
  }

  deleteTemporaryAccountBatch(hostId: string, now: Date, batchSize = DELETE_BATCH_SIZE) {
    return this.transaction(async (transaction) => {
      const repository = new JobsRepository(transaction, this.transaction);
      return repository.deleteTemporaryAccountBatchInTransaction(hostId, now, batchSize);
    });
  }

  private async deleteTemporaryAccountBatchInTransaction(
    hostId: string,
    now: Date,
    batchSize: number
  ): Promise<{ deletedRows: number; accountDeleted: boolean }> {
    const [eligibleUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, hostId),
          eq(users.accountType, 'TEMPORARY'),
          lte(users.purgeAt, now),
          sql`NOT EXISTS (
            SELECT 1 FROM polling_stations
            WHERE polling_stations.host_id = ${users.id}
              AND polling_stations.status NOT IN ('ARCHIVED', 'CANCELLED')
          )`
        )
      )
      .for('update')
      .limit(1);
    if (!eligibleUser) {
      return { deletedRows: 0, accountDeleted: false };
    }

    const stationIds = this.db
      .select({ id: pollingStations.id })
      .from(pollingStations)
      .where(eq(pollingStations.hostId, hostId));
    const categoryIds = this.db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.pollingStationId, stationIds));
    let deletedRows = 0;

    deletedRows += (
      await this.db
        .delete(registeredVoters)
        .where(
          inArray(
            registeredVoters.id,
            this.db
              .select({ id: registeredVoters.id })
              .from(registeredVoters)
              .where(inArray(registeredVoters.pollingStationId, stationIds))
              .limit(batchSize)
          )
        )
        .returning({ id: registeredVoters.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(deviceRecords)
        .where(
          inArray(
            deviceRecords.id,
            this.db
              .select({ id: deviceRecords.id })
              .from(deviceRecords)
              .where(inArray(deviceRecords.pollingStationId, stationIds))
              .limit(batchSize)
          )
        )
        .returning({ id: deviceRecords.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(castVotes)
        .where(
          inArray(
            castVotes.id,
            this.db
              .select({ id: castVotes.id })
              .from(castVotes)
              .where(inArray(castVotes.pollingStationId, stationIds))
              .limit(batchSize)
          )
        )
        .returning({ id: castVotes.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(activityLog)
        .where(
          inArray(
            activityLog.id,
            this.db
              .select({ id: activityLog.id })
              .from(activityLog)
              .where(inArray(activityLog.pollingStationId, stationIds))
              .limit(batchSize)
          )
        )
        .returning({ id: activityLog.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(payments)
        .where(
          inArray(
            payments.id,
            this.db
              .select({ id: payments.id })
              .from(payments)
              .where(eq(payments.hostId, hostId))
              .limit(batchSize)
          )
        )
        .returning({ id: payments.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(sessions)
        .where(
          inArray(
            sessions.id,
            this.db
              .select({ id: sessions.id })
              .from(sessions)
              .where(eq(sessions.userId, hostId))
              .limit(batchSize)
          )
        )
        .returning({ id: sessions.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(passwordResetTokens)
        .where(
          inArray(
            passwordResetTokens.id,
            this.db
              .select({ id: passwordResetTokens.id })
              .from(passwordResetTokens)
              .where(eq(passwordResetTokens.userId, hostId))
              .limit(batchSize)
          )
        )
        .returning({ id: passwordResetTokens.id })
    ).length;
    deletedRows += (
      await this.db
        .delete(emailVerificationTokens)
        .where(
          inArray(
            emailVerificationTokens.id,
            this.db
              .select({ id: emailVerificationTokens.id })
              .from(emailVerificationTokens)
              .where(eq(emailVerificationTokens.userId, hostId))
              .limit(batchSize)
          )
        )
        .returning({ id: emailVerificationTokens.id })
    ).length;

    const [remainingVotes] = await this.db
      .select({ id: castVotes.id })
      .from(castVotes)
      .where(inArray(castVotes.pollingStationId, stationIds))
      .limit(1);
    if (!remainingVotes) {
      deletedRows += (
        await this.db
          .delete(candidates)
          .where(
            inArray(
              candidates.id,
              this.db
                .select({ id: candidates.id })
                .from(candidates)
                .where(inArray(candidates.categoryId, categoryIds))
                .limit(batchSize)
            )
          )
          .returning({ id: candidates.id })
      ).length;
      const [remainingCandidates] = await this.db
        .select({ id: candidates.id })
        .from(candidates)
        .innerJoin(categories, eq(candidates.categoryId, categories.id))
        .where(inArray(categories.pollingStationId, stationIds))
        .limit(1);
      if (!remainingCandidates) {
        deletedRows += (
          await this.db
            .delete(categories)
            .where(
              inArray(
                categories.id,
                this.db
                  .select({ id: categories.id })
                  .from(categories)
                  .where(inArray(categories.pollingStationId, stationIds))
                  .limit(batchSize)
              )
            )
            .returning({ id: categories.id })
        ).length;
      }
    }

    await this.db
      .update(activityLog)
      .set({ actorUserId: null })
      .where(
        inArray(
          activityLog.id,
          this.db
            .select({ id: activityLog.id })
            .from(activityLog)
            .where(eq(activityLog.actorUserId, hostId))
            .limit(batchSize)
        )
      );

    const [remainingVoter] = await this.db
      .select({ id: registeredVoters.id })
      .from(registeredVoters)
      .where(inArray(registeredVoters.pollingStationId, stationIds))
      .limit(1);
    const [remainingDevice] = await this.db
      .select({ id: deviceRecords.id })
      .from(deviceRecords)
      .where(inArray(deviceRecords.pollingStationId, stationIds))
      .limit(1);
    const [remainingActivity] = await this.db
      .select({ id: activityLog.id })
      .from(activityLog)
      .where(inArray(activityLog.pollingStationId, stationIds))
      .limit(1);
    const [remainingCategory] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.pollingStationId, stationIds))
      .limit(1);
    if (
      !remainingVoter &&
      !remainingDevice &&
      !remainingVotes &&
      !remainingActivity &&
      !remainingCategory
    ) {
      deletedRows += (
        await this.db
          .delete(pollingStations)
          .where(
            inArray(
              pollingStations.id,
              this.db
                .select({ id: pollingStations.id })
                .from(pollingStations)
                .where(eq(pollingStations.hostId, hostId))
                .limit(batchSize)
            )
          )
          .returning({ id: pollingStations.id })
      ).length;
    }

    const [remainingStation] = await this.db
      .select({ id: pollingStations.id })
      .from(pollingStations)
      .where(eq(pollingStations.hostId, hostId))
      .limit(1);
    if (!remainingStation) {
      const [remainingPayment] = await this.db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.hostId, hostId))
        .limit(1);
      const [remainingSession] = await this.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, hostId))
        .limit(1);
      const [remainingResetToken] = await this.db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, hostId))
        .limit(1);
      const [remainingVerificationToken] = await this.db
        .select({ id: emailVerificationTokens.id })
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, hostId))
        .limit(1);
      const [remainingActorActivity] = await this.db
        .select({ id: activityLog.id })
        .from(activityLog)
        .where(eq(activityLog.actorUserId, hostId))
        .limit(1);
      if (
        !remainingPayment &&
        !remainingSession &&
        !remainingResetToken &&
        !remainingVerificationToken &&
        !remainingActorActivity
      ) {
        const deleted = await this.db
          .delete(users)
          .where(
            and(eq(users.id, hostId), eq(users.accountType, 'TEMPORARY'), lte(users.purgeAt, now))
          )
          .returning({ id: users.id });
        return { deletedRows: deletedRows + deleted.length, accountDeleted: deleted.length > 0 };
      }
    }

    return { deletedRows, accountDeleted: false };
  }

  async findTemporaryWarnings(now: Date, warningWindowEnd: Date, batchSize = DEFAULT_BATCH_SIZE) {
    return this.db
      .select({
        id: users.id,
        email: users.email
      })
      .from(users)
      .where(
        and(
          eq(users.accountType, 'TEMPORARY'),
          lte(users.purgeAt, warningWindowEnd),
          sql`${users.purgeAt} > ${now}`,
          isNull(users.inactivityWarningSentAt),
          sql`NOT EXISTS (
            SELECT 1 FROM polling_stations
            WHERE polling_stations.host_id = ${users.id}
              AND polling_stations.status NOT IN ('ARCHIVED', 'CANCELLED')
          )`
        )
      )
      .orderBy(asc(users.purgeAt), asc(users.id))
      .limit(batchSize);
  }

  async findInactiveLongTermHosts(cutoff: Date, batchSize = DEFAULT_BATCH_SIZE) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        lastLoginAt: users.lastLoginAt
      })
      .from(users)
      .where(
        and(
          eq(users.accountType, 'LONG_TERM'),
          lte(users.lastLoginAt, cutoff),
          isNotNull(users.lastLoginAt),
          isNull(users.inactivityWarningSentAt)
        )
      )
      .orderBy(asc(users.lastLoginAt), asc(users.id))
      .limit(batchSize);
  }

  async claimTemporaryWarning(userId: string, now: Date): Promise<boolean> {
    const marked = await this.db
      .update(users)
      .set({ inactivityWarningSentAt: now })
      .where(
        and(
          eq(users.id, userId),
          eq(users.accountType, 'TEMPORARY'),
          isNull(users.inactivityWarningSentAt),
          lte(users.purgeAt, new Date(now.getTime() + 48 * 60 * 60 * 1000)),
          sql`${users.purgeAt} > ${now}`,
          sql`NOT EXISTS (
            SELECT 1 FROM polling_stations
            WHERE polling_stations.host_id = ${users.id}
              AND polling_stations.status NOT IN ('ARCHIVED', 'CANCELLED')
          )`
        )
      )
      .returning({ id: users.id });
    return marked.length > 0;
  }

  async claimLongTermWarning(
    userId: string,
    lastLoginAt: Date,
    cutoff: Date,
    now: Date
  ): Promise<boolean> {
    const claimed = await this.db
      .update(users)
      .set({ inactivityWarningSentAt: now })
      .where(
        and(
          eq(users.id, userId),
          eq(users.accountType, 'LONG_TERM'),
          eq(users.lastLoginAt, lastLoginAt),
          lte(users.lastLoginAt, cutoff),
          isNull(users.inactivityWarningSentAt)
        )
      )
      .returning({ id: users.id });
    return claimed.length > 0;
  }

  async releaseWarningClaim(userId: string, claimedAt: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ inactivityWarningSentAt: null })
      .where(and(eq(users.id, userId), eq(users.inactivityWarningSentAt, claimedAt)));
  }

  async markInactiveLongTermHosts(cutoff: Date): Promise<number> {
    const marked = await this.db
      .update(users)
      .set({ purgeAt: sql`${users.lastLoginAt} + interval '6 months'` })
      .where(
        and(
          eq(users.accountType, 'LONG_TERM'),
          lte(users.lastLoginAt, cutoff),
          isNull(users.purgeAt)
        )
      )
      .returning({ id: users.id });
    return marked.length;
  }

  private eligiblePurgeStation(stationId: string, cutoff: Date) {
    return this.db
      .select({ id: pollingStations.id })
      .from(pollingStations)
      .innerJoin(users, eq(users.id, pollingStations.hostId))
      .where(
        and(
          eq(pollingStations.id, stationId),
          eq(pollingStations.status, 'VOTE_CLOSED'),
          lte(pollingStations.closedAt, cutoff),
          ne(users.plan, 'PREMIUM'),
          or(eq(users.accountType, 'TEMPORARY'), eq(users.plan, 'PAY_PER_USE'))
        )
      )
      .limit(1);
  }
}
