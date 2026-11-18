import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError, ValidationError } from '../../domain/errors';

/**
 * Express middleware for validation and centralized error responses.
 * All handlers here produce the same `{ error: { code, message, details? } }`
 * envelope so clients can rely on a single error shape.
 */

/** Maps a Zod error's issues to the compact `{ path, message }` detail shape. */
function formatZodIssues(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/** Sends a 400 validation-error response built from a Zod error. */
function sendZodValidationError(res: Response, err: ZodError, message: string): void {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message,
      details: formatZodIssues(err),
    },
  });
}

/**
 * Factory for middleware that validates a request field against a Zod schema
 * and replaces it with the parsed (typed) result.
 */
function validateWith(schema: ZodSchema, target: 'body' | 'params', message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        sendZodValidationError(res, err, message);
        return;
      }
      next(err);
    }
  };
}

/** Validates and replaces `req.body`. */
export function validateBody(schema: ZodSchema) {
  return validateWith(schema, 'body', 'Invalid request body');
}

/** Validates and replaces `req.params`. */
export function validateParams(schema: ZodSchema) {
  return validateWith(schema, 'params', 'Invalid path parameters');
}

/**
 * Final error middleware: converts any thrown error into a structured JSON
 * response. Expected errors (`AppError`, `ZodError`) map to their status
 * codes; anything else becomes a generic 500.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    const validation = new ValidationError('Invalid request body');
    res.status(validation.status).json({
      error: {
        code: validation.code,
        message: validation.message,
        details: formatZodIssues(err),
      },
    });
    return;
  }

  req.log?.error?.({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
