import type { AppConfig } from './config/env.js';
import { HealthController } from './controllers/health.controller.js';
import { createLogger } from './core/logger.js';
import type { AppDependencies } from './core/types.js';
import { HealthService } from './services/health.service.js';

export function createContainer(config: AppConfig): AppDependencies {
  const healthService = new HealthService(config);

  return {
    config,
    healthController: new HealthController(healthService),
    logger: createLogger()
  };
}
