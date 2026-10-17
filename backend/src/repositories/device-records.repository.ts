import { and, eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { deviceRecords } from '../db/schema/device-records.js';

export class DeviceRecordsRepository extends BaseRepository {
  findById(id: string) {
    return this.first(
      this.db.select().from(deviceRecords).where(eq(deviceRecords.id, id)).limit(1)
    );
  }

  findByStationAndClientDeviceUuid(pollingStationId: string, clientDeviceUuid: string) {
    return this.first(
      this.db
        .select()
        .from(deviceRecords)
        .where(
          and(
            eq(deviceRecords.pollingStationId, pollingStationId),
            eq(deviceRecords.clientDeviceUuid, clientDeviceUuid)
          )
        )
        .limit(1)
    );
  }

  create(values: typeof deviceRecords.$inferInsert) {
    return this.first(this.db.insert(deviceRecords).values(values).returning());
  }

  update(id: string, values: Partial<typeof deviceRecords.$inferInsert>) {
    return this.first(
      this.db.update(deviceRecords).set(values).where(eq(deviceRecords.id, id)).returning()
    );
  }

  delete(id: string) {
    return this.db.delete(deviceRecords).where(eq(deviceRecords.id, id)).returning();
  }
}
