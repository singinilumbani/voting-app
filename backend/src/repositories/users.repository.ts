import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { users } from '../db/schema/users.js';

export class UsersRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(users).where(eq(users.id, id)).limit(1));
  }

  findByEmail(email: string) {
    return this.first(this.db.select().from(users).where(eq(users.email, email)).limit(1));
  }

  create(values: typeof users.$inferInsert) {
    return this.first(this.db.insert(users).values(values).returning());
  }

  update(id: string, values: Partial<typeof users.$inferInsert>) {
    return this.first(this.db.update(users).set(values).where(eq(users.id, id)).returning());
  }

  delete(id: string) {
    return this.db.delete(users).where(eq(users.id, id)).returning();
  }
}
