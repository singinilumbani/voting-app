import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './app-error.js';
import type { Logger } from './logger.js';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    const requestIdValue = response.locals.requestId as string | undefined;
    let statusCode = 500;
    let key = 'errors.internal';
    let params: AppError['params'];

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      key = error.key;
      params = error.params;
    } else if (
      error !== null &&
      typeof error === 'object' &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      statusCode = 413;
      key = 'errors.request.body_too_large';
    }

    logger.error({
      event: 'request.error',
      requestId: requestIdValue,
      statusCode,
      errorKey: key
    });

    response.status(statusCode).json({
      error: {
        key,
        ...(params ? { params } : {}),
        requestId: requestIdValue ?? 'unavailable'
      }
    });
  };
}

export const routeNotFound: RequestHandler = (_request, _response, next) => {
  next(new AppError('errors.route.not_found', 404));
};
