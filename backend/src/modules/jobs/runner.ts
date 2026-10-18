import type { AppConfig } from '../../config/env.js';
import { createLogger } from '../../core/logger.js';
import type { DbClient } from '../../db/client.js';
import type { EmailService } from '../../services/email.service.js';
import { accountLifecycle, retentionPurge, stationTick } from './jobs.js';
import { JobsRepository } from './jobs.repository.js';

export const JOB_CRONS = {
  stationTick: '* * * * *',
  retentionPurge: '0 * * * *',
  accountLifecycle: '0 0 * * *'
} as const;

export type JobCron = (typeof JOB_CRONS)[keyof typeof JOB_CRONS];

export async function runCronJob(
  cron: string,
  client: DbClient,
  config: AppConfig,
  emailService: EmailService
): Promise<void> {
  const repository = JobsRepository.fromClient(client);
  const logger = createLogger();
  const now = new Date();
  try {
    if (cron === JOB_CRONS.stationTick) {
      const result = await stationTick(repository, {
        now,
        retentionDays: config.retentionDays
      });
      logger.info({ event: 'jobs.station_tick.completed', ...result });
      return;
    }

    if (cron === JOB_CRONS.retentionPurge) {
      const result = await retentionPurge(repository, {
        now,
        retentionDays: config.retentionDays
      });
      logger.info({ event: 'jobs.retention_purge.completed', ...result });
      return;
    }

    if (cron === JOB_CRONS.accountLifecycle) {
      const result = await accountLifecycle(repository, emailService, {
        now,
        appBaseUrl: config.appBaseUrl
      });
      logger.info({ event: 'jobs.account_lifecycle.completed', ...result });
      return;
    }

    throw new Error('Unrecognized scheduled job cron expression');
  } catch (error) {
    logger.error({
      event: 'jobs.execution.failed',
      errorType: error instanceof Error ? error.name : 'unknown'
    });
    throw error;
  }
}

export async function runAllJobs(
  client: DbClient,
  config: AppConfig,
  emailService: EmailService
): Promise<void> {
  const logger = createLogger();
  const repository = JobsRepository.fromClient(client);
  const now = new Date();
  try {
    const stationResult = await stationTick(repository, {
      now,
      retentionDays: config.retentionDays
    });
    logger.info({ event: 'jobs.station_tick.completed', ...stationResult });

    const retentionResult = await retentionPurge(repository, {
      now,
      retentionDays: config.retentionDays
    });
    logger.info({ event: 'jobs.retention_purge.completed', ...retentionResult });

    const lifecycleResult = await accountLifecycle(repository, emailService, {
      now,
      appBaseUrl: config.appBaseUrl
    });
    logger.info({ event: 'jobs.account_lifecycle.completed', ...lifecycleResult });
  } catch (error) {
    logger.error({
      event: 'jobs.execution.failed',
      errorType: error instanceof Error ? error.name : 'unknown'
    });
    throw error;
  }
}
