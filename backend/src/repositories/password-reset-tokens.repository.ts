import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { passwordResetTokens } from '../db/schema/password-reset-tokens.js';

export class PasswordResetTokensRepository extends BaseRepository {
  findById(id: string) {
    return this.first(
      this.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, id)).limit(1)
    );
  }

  findByTokenHash(tokenHash: string) {
    return this.first(
      this.db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .limit(1)
    );
  }

  create(values: typeof passwordResetTokens.$inferInsert) {
    return this.first(this.db.insert(passwordResetTokens).values(values).returning());
  }

  update(id: string, values: Partial<typeof passwordResetTokens.$inferInsert>) {
    return this.first(
      this.db
        .update(passwordResetTokens)
        .set(values)
        .where(eq(passwordResetTokens.id, id))
        .returning()
    );
  }

  delete(id: string) {
    return this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id)).returning();
  }
}
