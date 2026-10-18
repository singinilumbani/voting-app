import type { NextFunction, Request, Response } from 'express';
import type { AppDependencies } from '../core/types.js';

export function databaseLifecycle(dependencies: AppDependencies) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const provider = dependencies.databaseClientProvider;
    if (!provider) {
      next();
      return;
    }

    void provider()
      .then((client) => {
        response.locals.database = client.db;
        response.locals.databaseClient = client;

        if (dependencies.closeDatabaseClientAfterRequest) {
          let closed = false;
          const closeClient = () => {
            if (closed) {
              return;
            }
            closed = true;

            void client.close().catch(() => {
              dependencies.logger.error({ event: 'database.request_pool_close_failed' });
            });
          };
          response.once('finish', () => {
            closeClient();
          });
          response.once('close', closeClient);
        }

        next();
      })
      .catch(next);
  };
}
