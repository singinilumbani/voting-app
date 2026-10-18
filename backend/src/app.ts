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
import { voterServiceLifecycle } from './middleware/voter-service-lifecycle.js';
import { votingServiceLifecycle } from './middleware/voting-service-lifecycle.js';

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
  app.use(voterServiceLifecycle(deps.voterServiceFactory));
  app.use(votingServiceLifecycle(deps.votingServiceFactory));

  app.get('/api/v1/health', deps.healthController.get);
  app.use('/api/v1/host/auth', createHostAuthRouter(deps.hostAuthController));
  app.use(
    '/api/v1/host/stations',
    createHostStationsRouter(deps.stationController, deps.voterController)
  );
  app.use(
    '/api/v1/public/stations',
    createPublicStationsRouter(deps.stationController, deps.voterController, deps.votingController)
  );

  app.use(routeNotFound);
  app.use(createErrorHandler(deps.logger));

  return app;
}
