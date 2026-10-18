import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createNeonDbClient } from './db/neon-client.js';
import { createLogger } from './core/logger.js';
import { createEmailService } from './services/email.service.js';
import { runCronJob } from './modules/jobs/runner.js';

const config = loadConfig(env);
const app = createApp(
  createContainer(config, {
    databaseClientScope: 'request',
    createDatabaseClient: createNeonDbClient,
    rateLimitBindings: {
      strict: env.STRICT_RATE_LIMITER,
      loose: env.LOOSE_RATE_LIMITER
    }
  })
);

app.listen(config.port);

const httpHandler = httpServerHandler({ port: config.port });

export default {
  ...httpHandler,
  scheduled(controller: ScheduledController, _environment: Env, context: ExecutionContext) {
    context.waitUntil(
      (async () => {
        const client = await createNeonDbClient(config);
        try {
          await runCronJob(
            controller.cron,
            client,
            config,
            createEmailService(config, createLogger())
          );
        } finally {
          await client.close();
        }
      })()
    );
  }
};
