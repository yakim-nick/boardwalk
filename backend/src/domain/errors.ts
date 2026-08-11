/**
 * Application error hierarchy.
 *
 * Every error that should reach the HTTP layer as a structured JSON response
 * extends `AppError`. The error middleware maps `status`/`code`/`message`
 * directly onto the response body, so controllers never format errors by hand.
 */

/** Base class for all expected, client-facing errors. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 400 — request payload or parameters failed validation. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

/** 401 — missing, malformed, or expired credentials. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/** 403 — authenticated but not allowed to perform the action. */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(403, 'FORBIDDEN', message);
  }
}

/** 404 — the requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 409 — the request conflicts with the current state (e.g. duplicate email). */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(409, 'CONFLICT', message);
  }
}