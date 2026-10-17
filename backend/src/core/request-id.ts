import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (_request, response, next) => {
  const id = crypto.randomUUID();
  response.locals.requestId = id;
  response.setHeader('X-Request-Id', id);
  next();
};
