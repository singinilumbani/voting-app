import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { NeonDatabase, NeonTransaction } from 'drizzle-orm/neon-serverless';
import type { NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { AppConfig } from '../config/env.js';
import type * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;
export type DbTransaction =
  | NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>
  | NeonTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;
export type DatabaseExecutor = Database | DbTransaction;

export interface DbClient {
  db: Database;
  withTransaction<T>(fn: (transaction: DbTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type DbClientFactory = (config: AppConfig) => Promise<DbClient>;
