import type { RequestHandler } from 'express';
import type { DbClient } from '../db/client.js';
import type { VoterService } from '../services/voter.service.js';

export type VoterServiceFactory = (client: DbClient) => VoterService;

export function voterServiceLifecycle(factory: VoterServiceFactory): RequestHandler {
  return (_request, response, next) => {
    const client = response.locals.databaseClient as DbClient | undefined;
    if (client) response.locals.voterService = factory(client);
    next();
  };
}
