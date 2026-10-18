import express from 'express';
import { createErrorHandler, routeNotFound } from './core/error-handler.js';
import { requestId } from './core/request-id.js';
import type { AppDependencies } from './core/types.js';
import { bodyLimit } from './middleware/body-limit.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/security-headers.js';
import { databaseLifecycle } from './middleware/database-lifecycle.js';
import { createHostAuthRouter } from './routes/host-auth.js';
import { hostAuthServiceLifecycle } from './middleware/host-auth-service-lifecycle.js';
import { stationServiceLifecycle } from './middleware/station-service-lifecycle.js';
import { createHostStationsRouter, createPublicStationsRouter } from './routes/host-stations.js';

export function createApp(deps: AppDependencies) {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(securityHeaders);
  app.use(createCorsMiddleware(deps.config));
  app.use(bodyLimit);
  app.use(databaseLifecycle(deps));
  app.use(hostAuthServiceLifecycle(deps.hostAuthServiceFactory));
  app.use(stationServiceLifecycle(deps.stationServiceFactory));

  app.get('/api/v1/health', deps.healthController.get);
  app.use('/api/v1/host/auth', createHostAuthRouter(deps.hostAuthController));
  app.use('/api/v1/host/stations', createHostStationsRouter(deps.stationController));
  app.use('/api/v1/public/stations', createPublicStationsRouter(deps.stationController));

  app.use(routeNotFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
