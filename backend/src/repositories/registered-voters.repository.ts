import { and, eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { registeredVoters } from '../db/schema/registered-voters.js';

export class RegisteredVotersRepository extends BaseRepository {
  findById(id: string) {
    return this.first(
      this.db.select().from(registeredVoters).where(eq(registeredVoters.id, id)).limit(1)
    );
  }

  findByStationAndPhone(pollingStationId: string, phoneNumber: string) {
    return this.first(
      this.db
        .select()
        .from(registeredVoters)
        .where(
          and(
            eq(registeredVoters.pollingStationId, pollingStationId),
            eq(registeredVoters.phoneNumber, phoneNumber)
          )
        )
        .limit(1)
    );
  }

  findByStationAndTokenHash(pollingStationId: string, tokenHash: string) {
    return this.first(
      this.db
        .select()
        .from(registeredVoters)
        .where(
          and(
            eq(registeredVoters.pollingStationId, pollingStationId),
            eq(registeredVoters.tokenHash, tokenHash)
          )
        )
        .limit(1)
    );
  }

  create(values: typeof registeredVoters.$inferInsert) {
    return this.first(this.db.insert(registeredVoters).values(values).returning());
  }

  update(id: string, values: Partial<typeof registeredVoters.$inferInsert>) {
    return this.first(
      this.db.update(registeredVoters).set(values).where(eq(registeredVoters.id, id)).returning()
    );
  }

  delete(id: string) {
    return this.db.delete(registeredVoters).where(eq(registeredVoters.id, id)).returning();
  }
}
