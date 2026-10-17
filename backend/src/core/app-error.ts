export type ErrorParams = Record<string, string | number | boolean>;

export class AppError extends Error {
  constructor(
    public readonly key: string,
    public readonly statusCode: number,
    public readonly params?: ErrorParams
  ) {
    super(key);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(params?: ErrorParams) {
    super('errors.validation.failed', 400, params);
  }
}

export class NotFoundError extends AppError {
  constructor(key = 'errors.resource.not_found') {
    super(key, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(key = 'errors.auth.unauthorized') {
    super(key, 401);
  }
}

export class ConflictError extends AppError {
  constructor(key = 'errors.resource.conflict') {
    super(key, 409);
  }
}
