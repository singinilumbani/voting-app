import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { candidates } from '../db/schema/candidates.js';

export class CandidatesRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(candidates).where(eq(candidates.id, id)).limit(1));
  }

  findByCategoryId(categoryId: string) {
    return this.db.select().from(candidates).where(eq(candidates.categoryId, categoryId));
  }

  create(values: typeof candidates.$inferInsert) {
    return this.first(this.db.insert(candidates).values(values).returning());
  }

  update(id: string, values: Partial<typeof candidates.$inferInsert>) {
    return this.first(
      this.db.update(candidates).set(values).where(eq(candidates.id, id)).returning()
    );
  }

  delete(id: string) {
    return this.db.delete(candidates).where(eq(candidates.id, id)).returning();
  }
}
