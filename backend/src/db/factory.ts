import type { AppConfig } from '../config/env.js';
import type { DbClient } from './client.js';
import { createNeonDbClient } from './neon-client.js';
import { createNodePostgresDbClient } from './node-postgres-client.js';

export function createDbClient(config: AppConfig): Promise<DbClient> {
  return config.dbDriver === 'pg' ? createNodePostgresDbClient(config) : createNeonDbClient(config);
}
