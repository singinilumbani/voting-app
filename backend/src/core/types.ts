import type { AppConfig } from '../config/env.js';
import type { HealthController } from '../controllers/health.controller.js';
import type { Logger } from './logger.js';
import type { DbClient } from '../db/client.js';
import type { HostAuthController } from '../controllers/host-auth.controller.js';
import type { HostAuthServiceFactory } from '../middleware/host-auth-service-lifecycle.js';
import type { StationController } from '../controllers/station.controller.js';
import type { StationServiceFactory } from '../middleware/station-service-lifecycle.js';

export interface AppDependencies {
  config: AppConfig;
  healthController: HealthController;
  hostAuthController: HostAuthController;
  stationController: StationController;
  hostAuthServiceFactory: HostAuthServiceFactory;
  stationServiceFactory: StationServiceFactory;
  logger: Logger;
  databaseClientProvider?: () => Promise<DbClient>;
  closeDatabaseClientAfterRequest?: boolean;
  closeDatabaseClient?: () => Promise<void>;
}
