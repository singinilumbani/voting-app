import type { RequestHandler } from 'express';
import type { HealthService } from '../services/health.service.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  readonly get: RequestHandler = (_request, response) => {
    response.json(this.healthService.getStatus());
  };
}
