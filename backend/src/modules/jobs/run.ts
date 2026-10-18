import { config as loadDotenv } from 'dotenv';
import { loadConfig } from '../../config/env.js';
import { createLogger } from '../../core/logger.js';
import { createDbClient } from '../../db/factory.js';
import { createEmailService } from '../../services/email.service.js';
import { runAllJobs } from './runner.js';

loadDotenv({ path: '.env.local' });

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const client = await createDbClient(config);
  try {
    await runAllJobs(client, config, createEmailService(config, createLogger()));
  } finally {
    await client.close();
  }
}

void main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({
    event: 'jobs.local_run.failed',
    errorType: error instanceof Error ? error.name : 'unknown'
  });
  process.exitCode = 1;
});
