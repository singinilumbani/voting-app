import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { AppConfig } from '../config/env.js';
import type { DbClient } from './client.js';
import * as schema from './schema/index.js';

export async function createNeonDbClient(config: AppConfig): Promise<DbClient> {
  if (config.dbDriver !== 'neon') {
    throw new Error('DB_DRIVER=neon is required for the Neon database client');
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database client');
  }

  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool, { schema });

  return {
    db,
    withTransaction: (fn) => db.transaction((transaction) => fn(transaction)),
    close: () => pool.end()
  };
}
