import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createDbClient } from './db/factory.js';

const config = loadConfig(process.env);
const dependencies = createContainer(config, { createDatabaseClient: createDbClient });
const app = createApp(dependencies);

const server = app.listen(config.port, '0.0.0.0', () => {
  console.info(`Backend listening on port ${config.port}`);
});
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await dependencies.closeDatabaseClient?.();
}

process.once('SIGINT', () => {
  void shutdown().catch(() => {
    console.error('Database or HTTP server shutdown failed');
    process.exitCode = 1;
  });
});
process.once('SIGTERM', () => {
  void shutdown().catch(() => {
    console.error('Database or HTTP server shutdown failed');
    process.exitCode = 1;
  });
});
