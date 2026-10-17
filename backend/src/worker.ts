import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';

const config = loadConfig(env);
const app = createApp(createContainer(config));

app.listen(config.port);

export default httpServerHandler({ port: config.port });
