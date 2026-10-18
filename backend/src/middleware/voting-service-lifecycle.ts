import type { RequestHandler } from 'express';
import type { DbClient } from '../db/client.js';
import type { VotingService } from '../services/voting.service.js';

export type VotingServiceFactory = (client: DbClient) => VotingService;

export function votingServiceLifecycle(factory: VotingServiceFactory): RequestHandler {
  return (_request, response, next) => {
    const client = response.locals.databaseClient as DbClient | undefined;
    if (client) response.locals.votingService = factory(client);
    next();
  };
}
