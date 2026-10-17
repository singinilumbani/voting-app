import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';

const config = loadConfig(process.env);
const app = createApp(createContainer(config));

app.listen(config.port, '0.0.0.0', () => {
  console.info(`Backend listening on port ${config.port}`);
});
