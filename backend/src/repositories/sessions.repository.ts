import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { sessions } from '../db/schema/sessions.js';

export class SessionsRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1));
  }

  findByTokenHash(tokenHash: string) {
    return this.first(
      this.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1)
    );
  }

  create(values: typeof sessions.$inferInsert) {
    return this.first(this.db.insert(sessions).values(values).returning());
  }

  update(id: string, values: Partial<typeof sessions.$inferInsert>) {
    return this.first(this.db.update(sessions).set(values).where(eq(sessions.id, id)).returning());
  }

  delete(id: string) {
    return this.db.delete(sessions).where(eq(sessions.id, id)).returning();
  }
}
