import type { AppConfig } from '../config/env.js';
import type { HealthController } from '../controllers/health.controller.js';
import type { Logger } from './logger.js';
import type { DbClient } from '../db/client.js';

export interface AppDependencies {
  config: AppConfig;
  healthController: HealthController;
  logger: Logger;
  databaseClientProvider?: () => Promise<DbClient>;
  closeDatabaseClientAfterRequest?: boolean;
  closeDatabaseClient?: () => Promise<void>;
}
