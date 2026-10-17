import { eq } from 'drizzle-orm';
import { BaseRepository } from '../db/base.repository.js';
import { payments } from '../db/schema/payments.js';

export class PaymentsRepository extends BaseRepository {
  findById(id: string) {
    return this.first(this.db.select().from(payments).where(eq(payments.id, id)).limit(1));
  }

  findByTransactionReference(txRef: string) {
    return this.first(this.db.select().from(payments).where(eq(payments.txRef, txRef)).limit(1));
  }

  create(values: typeof payments.$inferInsert) {
    return this.first(this.db.insert(payments).values(values).returning());
  }

  update(id: string, values: Partial<typeof payments.$inferInsert>) {
    return this.first(this.db.update(payments).set(values).where(eq(payments.id, id)).returning());
  }
}
