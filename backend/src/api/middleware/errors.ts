import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError, ValidationError } from '../../domain/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        });
        return;
      }
      next(err);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid path parameters',
            details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        });
        return;
      }
      next(err);
    }
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  req.log?.error?.({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
