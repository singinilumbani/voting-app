import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../config/env.js';
import { createDbClient } from '../factory.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (config.dbDriver !== 'pg') {
    throw new Error('Database migrations must use DB_DRIVER=pg');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to run database migrations');
  }

  const client = await createDbClient(config);
  try {
    await migrate(client.db, {
      migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url))
    });
  } finally {
    await client.close();
  }
}

main();
