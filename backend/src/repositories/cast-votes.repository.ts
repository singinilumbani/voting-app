import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { castVotes } from '../db/schema/cast-votes.js';

export class CastVotesRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(castVotes).where(eq(castVotes.id, id)).limit(1));
  }

  findByStationId(pollingStationId: string) {
    return this.db.select().from(castVotes).where(eq(castVotes.pollingStationId, pollingStationId));
  }

  create(values: typeof castVotes.$inferInsert) {
    return this.first(this.db.insert(castVotes).values(values).returning());
  }

  delete(id: string) {
    return this.db.delete(castVotes).where(eq(castVotes.id, id)).returning();
  }
}
