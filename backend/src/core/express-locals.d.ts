import type { DbClient } from '../db/client.js';
import type { AuthenticatedHost } from '../services/host-auth.service.js';
import type { HostAuthService } from '../services/host-auth.service.js';
import type { VoterService } from '../services/voter.service.js';

declare global {
  namespace Express {
    interface Locals {
      databaseClient?: DbClient;
      authenticatedHost?: AuthenticatedHost;
      hostAuthService?: HostAuthService;
      voterService?: VoterService;
    }
  }
}

export {};
