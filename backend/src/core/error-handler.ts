import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './app-error.js';
import type { Logger } from './logger.js';
import { MESSAGE_KEYS } from '../shared/messages.js';

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, next) => {
    void next;
    if (response.headersSent) {
      logger.error({
        event: 'request.error_after_response',
        requestId: response.locals.requestId,
        errorType: error instanceof Error ? error.name : 'unknown'
      });
      response.end();
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
      key = MESSAGE_KEYS.errors.request.bodyTooLarge;
    } else if (
      error !== null &&
      typeof error === 'object' &&
      'type' in error &&
      (error.type === 'entity.parse.failed' || error.type === 'request.aborted')
    ) {
      statusCode = 400;
      key = MESSAGE_KEYS.errors.request.bodyInvalid;
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
