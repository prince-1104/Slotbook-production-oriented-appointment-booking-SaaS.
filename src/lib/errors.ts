export class AppError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 400, details);
  }
}

export class ValidationError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 422, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'Authentication required') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Request forbidden') {
    super(code, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(code = 'NOT_FOUND', message = 'Resource not found') {
    super(code, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Content-Type must be application/json') {
    super('UNSUPPORTED_MEDIA_TYPE', message, 415);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Too many requests, please try again later') {
    super('RATE_LIMIT_EXCEEDED', message, 429, { retryAfterSeconds });
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(code = 'SERVICE_UNAVAILABLE', message = 'Service temporarily unavailable') {
    super(code, message, 503);
  }
}
