import type { RequestHandler } from 'express';
import { AppError, UnauthorizedError } from '../core/app-error.js';
import { readHostSessionCookie } from './host-session.js';

export const requireHost: RequestHandler = async (request, response, next) => {
  const service = response.locals.hostAuthService;
  if (!service) {
    throw new AppError('errors.auth.not_configured', 503);
  }
  const token = readHostSessionCookie(request);
  if (!token) {
    throw new UnauthorizedError();
  }
  const authenticated = await service.authenticate(token);
  if (!authenticated) {
    throw new UnauthorizedError();
  }
  response.locals.authenticatedHost = authenticated;
  next();
};
