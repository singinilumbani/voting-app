import type { AppConfig } from '../config/env.js';
import type { HealthController } from '../controllers/health.controller.js';
import type { Logger } from './logger.js';

export interface AppDependencies {
  config: AppConfig;
  healthController: HealthController;
  logger: Logger;
}
