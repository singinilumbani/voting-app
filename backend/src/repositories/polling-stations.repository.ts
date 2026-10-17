import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { pollingStations } from '../db/schema/polling-stations.js';

export class PollingStationsRepository extends BaseRepository {
  findById(id: string) {
    return this.first(
      this.db.select().from(pollingStations).where(eq(pollingStations.id, id)).limit(1)
    );
  }

  findByPublicId(publicId: string) {
    return this.first(
      this.db.select().from(pollingStations).where(eq(pollingStations.publicId, publicId)).limit(1)
    );
  }

  create(values: typeof pollingStations.$inferInsert) {
    return this.first(this.db.insert(pollingStations).values(values).returning());
  }

  update(id: string, values: Partial<typeof pollingStations.$inferInsert>) {
    return this.first(
      this.db.update(pollingStations).set(values).where(eq(pollingStations.id, id)).returning()
    );
  }

  delete(id: string) {
    return this.db.delete(pollingStations).where(eq(pollingStations.id, id)).returning();
  }
}
