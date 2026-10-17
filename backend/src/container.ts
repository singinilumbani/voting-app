import type { AppConfig } from './config/env.js';
import { HealthController } from './controllers/health.controller.js';
import { createLogger } from './core/logger.js';
import type { AppDependencies } from './core/types.js';
import { HealthService } from './services/health.service.js';
import type { DbClientFactory } from './db/client.js';

export function createContainer(
  config: AppConfig,
  options: {
    databaseClientScope?: 'shared' | 'request';
    createDatabaseClient?: DbClientFactory;
  } = {}
): AppDependencies {
  const healthService = new HealthService(config);
  const databaseClientScope = options.databaseClientScope ?? 'shared';
  const createDatabaseClient = options.createDatabaseClient;
  if (config.databaseUrl && !createDatabaseClient) {
    throw new Error('A database client factory is required when DATABASE_URL is configured');
  }
  let sharedDatabaseClient: ReturnType<DbClientFactory> | undefined;
  const databaseClientProvider =
    config.databaseUrl && createDatabaseClient
      ? () => {
          if (databaseClientScope === 'request') {
            return createDatabaseClient(config);
          }

          sharedDatabaseClient ??= createDatabaseClient(config);
          return sharedDatabaseClient;
        }
      : undefined;

  const dependencies: AppDependencies = {
    config,
    healthController: new HealthController(healthService),
    logger: createLogger(),
    ...(databaseClientProvider === undefined ? {} : { databaseClientProvider }),
    ...(databaseClientScope === 'request'
      ? { closeDatabaseClientAfterRequest: true }
      : { closeDatabaseClient: async () => (await sharedDatabaseClient)?.close() })
  };

  return dependencies;
}
