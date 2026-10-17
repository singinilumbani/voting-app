import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppConfig } from '../config/env.js';
import type { DbClient } from './client.js';
import * as schema from './schema/index.js';

export async function createNodePostgresDbClient(config: AppConfig): Promise<DbClient> {
  if (config.dbDriver !== 'pg') {
    throw new Error('DB_DRIVER=pg is required for the node-postgres database client');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database client');
  }

  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool, { schema });

  return {
    db,
    withTransaction: (fn) => db.transaction((transaction) => fn(transaction)),
    close: () => pool.end()
  };
}
