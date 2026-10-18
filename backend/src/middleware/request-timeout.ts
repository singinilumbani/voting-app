import type { RequestHandler } from 'express';
import { AppError } from '../core/app-error.js';
import { MESSAGE_KEYS } from '../shared/messages.js';

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function createRequestTimeout(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): RequestHandler {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('Request timeout must be a positive safe integer');
  }

  return (_request, response, next) => {
    let completed = false;
    const clearTimer = () => {
      completed = true;
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (!completed && !response.writableEnded) {
        next(new AppError(MESSAGE_KEYS.errors.request.timeout, 408));
      }
    }, timeoutMs);

    response.once('finish', clearTimer);
    response.once('close', clearTimer);
    next();
  };
}
