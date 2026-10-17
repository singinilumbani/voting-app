import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { categories } from './categories.js';

export const candidates = pgTable('candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  name: varchar('name', { length: 200 }).notNull(),
  cloudinaryImageUrl: text('cloudinary_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});
