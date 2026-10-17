import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../core/app-error.js';

export function validate<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(new ValidationError());
      return;
    }

    request.body = result.data;
    next();
  };
}
