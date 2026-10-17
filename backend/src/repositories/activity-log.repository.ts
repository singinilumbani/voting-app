import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { activityLog } from '../db/schema/activity-log.js';

export class ActivityLogRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(activityLog).where(eq(activityLog.id, id)).limit(1));
  }

  findByStationId(pollingStationId: string) {
    return this.db
      .select()
      .from(activityLog)
      .where(eq(activityLog.pollingStationId, pollingStationId));
  }

  create(values: typeof activityLog.$inferInsert) {
    return this.first(this.db.insert(activityLog).values(values).returning());
  }
}
