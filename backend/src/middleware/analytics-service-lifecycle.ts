import type { RequestHandler } from 'express';
import type { DbClient } from '../db/client.js';
import type { AnalyticsService } from '../services/analytics.service.js';

export type AnalyticsServiceFactory = (client: DbClient) => AnalyticsService;

export function analyticsServiceLifecycle(factory: AnalyticsServiceFactory): RequestHandler {
  return (_request, response, next) => {
    const client = response.locals.databaseClient as DbClient | undefined;
    if (client) response.locals.analyticsService = factory(client);
    next();
  };
}
