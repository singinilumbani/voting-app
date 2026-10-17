import cors from 'cors';
import { AppError } from '../core/app-error.js';
import type { AppConfig } from '../config/env.js';

export function createCorsMiddleware(config: AppConfig) {
  return cors({
    origin(origin, callback) {
      if (origin === undefined || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError('errors.cors.origin_denied', 403));
    },
    credentials: true
  });
}
