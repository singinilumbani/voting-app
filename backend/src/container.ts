import type { AppConfig } from './config/env.js';
import { HealthController } from './controllers/health.controller.js';
import { createLogger } from './core/logger.js';
import type { AppDependencies } from './core/types.js';
import { HealthService } from './services/health.service.js';
import type { DbClient, DbClientFactory } from './db/client.js';
import { HostAuthController } from './controllers/host-auth.controller.js';
import { createEmailService } from './services/email.service.js';
import { Pbkdf2PasswordHasher } from './services/password-hasher.js';
import {
  CloudflareRateLimiter,
  DatabaseRateLimiter,
  type CloudflareRateLimitBinding
} from './services/rate-limiter.js';
import { RateLimitRepository } from './repositories/rate-limit.repository.js';
import { HostAuthRepository } from './repositories/host-auth.repository.js';
import { HostAuthService } from './services/host-auth.service.js';
import type { EmailService } from './services/email.service.js';
import type { PasswordHasher } from './services/password-hasher.js';
import type { RateLimiter } from './services/rate-limiter.js';
import { StationController } from './controllers/station.controller.js';
import { StationRepository } from './repositories/station.repository.js';
import { StationService } from './services/station.service.js';
import { VoterController } from './controllers/voter.controller.js';
import { VoterRepository } from './repositories/voter.repository.js';
import { VoterService } from './services/voter.service.js';
import { VotingController } from './controllers/voting.controller.js';
import { VotingRepository } from './repositories/voting.repository.js';
import { VotingService } from './services/voting.service.js';
import { AnalyticsController } from './controllers/analytics.controller.js';
import { AnalyticsRepository } from './repositories/analytics.repository.js';
import { AnalyticsService } from './services/analytics.service.js';
import { InMemoryAnalyticsSnapshotCache } from './services/analytics.repository.js';

export function createContainer(
  config: AppConfig,
  options: {
    databaseClientScope?: 'shared' | 'request';
    createDatabaseClient?: DbClientFactory;
    emailService?: EmailService;
    passwordHasher?: PasswordHasher;
    rateLimiter?: RateLimiter;
    rateLimitBindings?: {
      strict?: CloudflareRateLimitBinding;
      loose?: CloudflareRateLimitBinding;
    };
  } = {}
): AppDependencies {
  const healthService = new HealthService(config);
  const logger = createLogger();
  const passwordHasher =
    options.passwordHasher ?? new Pbkdf2PasswordHasher(config.passwordHashIterations);
  const emailService = options.emailService ?? createEmailService(config, logger);
  const createRateLimiter = (
    client: DbClient,
    policy: 'strict' | 'loose',
    namespace: string,
    limit: number,
    windowMs: number
  ): RateLimiter => {
    const secret = config.tokenHmacSecret;
    if (!secret) {
      return {
        consume() {
          throw new Error('TOKEN_HMAC_SECRET is required for rate limiting');
        }
      };
    }
    const binding = options.rateLimitBindings?.[policy];
    if (binding) return new CloudflareRateLimiter(binding, secret, namespace);
    return new DatabaseRateLimiter(RateLimitRepository.fromClient(client), secret, limit, windowMs);
  };
  const hostAuthServiceFactory = (client: DbClient) =>
    new HostAuthService(HostAuthRepository.fromClient(client), {
      config,
      passwordHasher,
      emailService,
      rateLimiter:
        options.rateLimiter ?? createRateLimiter(client, 'strict', 'host-auth', 5, 15 * 60 * 1000)
    });
  const stationServiceFactory = (client: DbClient) =>
    new StationService(StationRepository.fromClient(client), { config });
  const voterServiceFactory = (client: DbClient) =>
    new VoterService(VoterRepository.fromClient(client), {
      config,
      registrationIpRateLimiter: createRateLimiter(client, 'loose', 'registration-ip', 30, 60_000),
      registrationPhoneRateLimiter: createRateLimiter(
        client,
        'strict',
        'registration-phone',
        5,
        15 * 60_000
      ),
      statusRateLimiter: createRateLimiter(client, 'loose', 'status-ip', 40, 60_000)
    });
  const votingServiceFactory = (client: DbClient) =>
    new VotingService(VotingRepository.fromClient(client), {
      config,
      ipRateLimiter: createRateLimiter(client, 'loose', 'voting-ip', 20, 60_000),
      phoneRateLimiter: createRateLimiter(client, 'strict', 'voting-phone', 5, 15 * 60_000)
    });
  const analyticsCache = new InMemoryAnalyticsSnapshotCache();
  const analyticsServiceFactory = (client: DbClient) =>
    new AnalyticsService(AnalyticsRepository.fromClient(client), analyticsCache);
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
    voterController: new VoterController(),
    votingController: new VotingController(),
    analyticsController: new AnalyticsController(),
    hostAuthServiceFactory,
    stationServiceFactory,
    voterServiceFactory,
    votingServiceFactory,
    analyticsServiceFactory,
    logger,
    requestTimeoutMs: 30_000,
    ...(databaseClientProvider === undefined ? {} : { databaseClientProvider }),
    ...(databaseClientScope === 'request'
      ? { closeDatabaseClientAfterRequest: true }
      : { closeDatabaseClient: async () => (await sharedDatabaseClient)?.close() })
  };

  return dependencies;
}
