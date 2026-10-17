import type { RequestHandler } from 'express';
import { AppError } from '../core/app-error.js';

export const authNotConfigured: RequestHandler = (_request, _response, next) => {
  next(new AppError('errors.auth.not_configured', 503));
};
