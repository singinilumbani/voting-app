import type { RequestHandler } from 'express';
import { AppError } from '../core/app-error.js';

export const rateLimitNotConfigured: RequestHandler = (_request, _response, next) => {
  next(new AppError('errors.rate_limit.not_configured', 503));
};
