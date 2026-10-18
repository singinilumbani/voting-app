import type { RequestHandler } from 'express';
import type { DbClient } from '../db/client.js';
import type { StationService } from '../services/station.service.js';

export type StationServiceFactory = (client: DbClient) => StationService;

export function stationServiceLifecycle(factory: StationServiceFactory): RequestHandler {
  return (_request, response, next) => {
    const client = response.locals.databaseClient as DbClient | undefined;
    if (client) {
      response.locals.stationService = factory(client);
    }
    next();
  };
}
