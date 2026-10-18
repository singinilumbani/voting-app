import type { RequestHandler, Response } from 'express';
import { AppError, UnauthorizedError, ValidationError } from '../core/app-error.js';
import type { AnalyticsService } from '../services/analytics.service.js';

export class AnalyticsController {
  readonly snapshot: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).snapshot(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json(result);
  };

  readonly audit: RequestHandler = async (request, response) => {
    const result = await this.serviceFor(response).audit(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.status(200).json(result);
  };

  readonly exportCsv: RequestHandler = async (request, response) => {
    const content = await this.serviceFor(response).exportCsv(
      authenticatedHost(response).id,
      param(request, 'stationId')
    );
    response.type('text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
    response.status(200).send(content);
  };

  private serviceFor(response: Response): AnalyticsService {
    const service = response.locals.analyticsService;
    if (!service) throw new AppError('errors.analytics.not_configured', 503);
    return service;
  }
}

function authenticatedHost(response: Response) {
  const host = response.locals.authenticatedHost?.host;
  if (!host) throw new UnauthorizedError();
  return host;
}

function param(request: Parameters<RequestHandler>[0], key: string): string {
  const value = request.params[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError({ reason: 'errors.validation' });
  }
  return value;
}
