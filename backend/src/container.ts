import type { AppConfig } from './config/env.js';
import { HealthController } from './controllers/health.controller.js';
import { createLogger } from './core/logger.js';
import type { AppDependencies } from './core/types.js';
import { HealthService } from './services/health.service.js';
import type { DbClient, DbClientFactory } from './db/client.js';
import { HostAuthController } from './controllers/host-auth.controller.js';
import { createEmailService } from './services/email.service.js';
import { Pbkdf2PasswordHasher } from './services/password-hasher.js';
import { InMemoryRateLimiter } from './services/rate-limiter.js';
import { HostAuthRepository } from './repositories/host-auth.repository.js';
import { HostAuthService } from './services/host-auth.service.js';
import type { EmailService } from './services/email.service.js';
import type { PasswordHasher } from './services/password-hasher.js';
import type { RateLimiter } from './services/rate-limiter.js';
import { StationController } from './controllers/station.controller.js';
import { StationRepository } from './repositories/station.repository.js';
import { StationService } from './services/station.service.js';

export function createContainer(
  config: AppConfig,
  options: {
    databaseClientScope?: 'shared' | 'request';
    createDatabaseClient?: DbClientFactory;
    emailService?: EmailService;
    passwordHasher?: PasswordHasher;
    rateLimiter?: RateLimiter;
  } = {}
): AppDependencies {
  const healthService = new HealthService(config);
  const logger = createLogger();
  const passwordHasher =
    options.passwordHasher ?? new Pbkdf2PasswordHasher(config.passwordHashIterations);
  const emailService = options.emailService ?? createEmailService(config, logger);
  const rateLimiter = options.rateLimiter ?? new InMemoryRateLimiter();
  const hostAuthServiceFactory = (client: DbClient) =>
    new HostAuthService(HostAuthRepository.fromClient(client), {
      config,
      passwordHasher,
      emailService,
      rateLimiter
    });
  const stationServiceFactory = (client: DbClient) =>
    new StationService(StationRepository.fromClient(client), { config });
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
    hostAuthController: new HostAuthController(config),
    stationController: new StationController(),
    hostAuthServiceFactory,
    stationServiceFactory,
    logger,
    ...(databaseClientProvider === undefined ? {} : { databaseClientProvider }),
    ...(databaseClientScope === 'request'
      ? { closeDatabaseClientAfterRequest: true }
      : { closeDatabaseClient: async () => (await sharedDatabaseClient)?.close() })
  };

  return dependencies;
}
