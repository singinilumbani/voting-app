import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createNeonDbClient } from './db/neon-client.js';

const config = loadConfig(env);
const app = createApp(
  createContainer(config, {
    databaseClientScope: 'request',
    createDatabaseClient: createNeonDbClient
  })
);

app.listen(config.port);

export default httpServerHandler({ port: config.port });
