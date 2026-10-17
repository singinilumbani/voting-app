import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { categories } from '../db/schema/categories.js';

export class CategoriesRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(categories).where(eq(categories.id, id)).limit(1));
  }

  findByStationId(pollingStationId: string) {
    return this.db
      .select()
      .from(categories)
      .where(eq(categories.pollingStationId, pollingStationId));
  }

  create(values: typeof categories.$inferInsert) {
    return this.first(this.db.insert(categories).values(values).returning());
  }

  update(id: string, values: Partial<typeof categories.$inferInsert>) {
    return this.first(
      this.db.update(categories).set(values).where(eq(categories.id, id)).returning()
    );
  }

  delete(id: string) {
    return this.db.delete(categories).where(eq(categories.id, id)).returning();
  }
}
