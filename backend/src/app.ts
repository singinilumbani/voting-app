import express from 'express';
import { createErrorHandler, routeNotFound } from './core/error-handler.js';
import { requestId } from './core/request-id.js';
import type { AppDependencies } from './core/types.js';
import { bodyLimit } from './middleware/body-limit.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/security-headers.js';
import { databaseLifecycle } from './middleware/database-lifecycle.js';

export function createApp(deps: AppDependencies) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(securityHeaders);
  app.use(createCorsMiddleware(deps.config));
  app.use(bodyLimit);
  app.use(databaseLifecycle(deps));

  app.get('/api/v1/health', deps.healthController.get);

  app.use(routeNotFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
