import type { RequestHandler } from 'express';
import type { DbClient } from '../db/client.js';
import type { HostAuthService } from '../services/host-auth.service.js';

export type HostAuthServiceFactory = (client: DbClient) => HostAuthService;

export function hostAuthServiceLifecycle(factory: HostAuthServiceFactory): RequestHandler {
  return (_request, response, next) => {
    const client = response.locals.databaseClient;
    if (client) {
      response.locals.hostAuthService = factory(client);
    }
    next();
  };
}
