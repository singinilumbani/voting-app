import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadConfig } from '../config/env.js';
import { createNodePostgresDbClient } from './node-postgres-client.js';
import type { DbClient } from './client.js';

const testDatabaseEnvironment = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => new URL(value).pathname === '/vote_app_test', {
      message: 'Test database must be named vote_app_test'
    })
});

const testTables = [
  'activity_log',
  'payments',
  'cast_votes',
  'device_records',
  'registered_voters',
  'rate_limit_counters',
  'candidates',
  'categories',
  'polling_stations',
  'password_reset_tokens',
  'email_verification_tokens',
  'sessions',
  'users'
] as const;

export async function createTestDatabase(): Promise<DbClient> {
  const environment = testDatabaseEnvironment.parse(process.env);
  const config = loadConfig({
    ...process.env,
    APP_ENV: 'test',
    DATABASE_URL: environment.DATABASE_URL,
    DB_DRIVER: 'pg'
  });
  const client = await createNodePostgresDbClient(config);

  try {
    await migrate(client.db, {
      migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url))
    });
    await truncateTestDatabase(client);
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function truncateTestDatabase(client: DbClient): Promise<void> {
  testDatabaseEnvironment.parse(process.env);
  await client.db.execute(
    sql.raw(`TRUNCATE TABLE ${testTables.join(', ')} RESTART IDENTITY CASCADE`)
  );
}
