import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadConfig } from '../../config/env.js';
import { createDbClient } from '../factory.js';

const resetEnvironmentSchema = z.object({
  APP_ENV: z.enum(['development', 'test'])
});

async function main(): Promise<void> {
  const { APP_ENV } = resetEnvironmentSchema.parse(process.env);
  const config = loadConfig(process.env);

  if (config.dbDriver !== 'pg') {
    throw new Error('Database reset must use DB_DRIVER=pg');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to reset the database');
  }

  const databaseName = new URL(config.databaseUrl).pathname.slice(1);
  const expectedDatabaseName = APP_ENV === 'test' ? 'vote_app_test' : 'vote_app_dev';
  if (databaseName !== expectedDatabaseName) {
    throw new Error(`db:reset for APP_ENV=${APP_ENV} requires database ${expectedDatabaseName}`);
  }

  const client = await createDbClient(config);
  try {
    await client.db.execute(sql.raw('DROP SCHEMA public CASCADE'));
    await client.db.execute(sql.raw('CREATE SCHEMA public'));
    await migrate(client.db, {
      migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url))
    });
  } finally {
    await client.close();
  }
}

main();
