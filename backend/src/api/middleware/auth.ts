import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../domain/services/auth.service';
import { UnauthorizedError } from '../../domain/errors';

/** Request augmented with the authenticated user's identity. */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

/** Extracts the raw token from an `Authorization: Bearer <token>` header. */
function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Express middleware factory that authenticates requests via a JWT.
 * On success it attaches `userId`/`userEmail` to the request; otherwise it
 * rejects with a 401 before the route handler runs.
 */
export function requireAuth(auth: AuthService) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const payload = await auth.verifyToken(token);
      req.userId = payload.sub;
      req.userEmail = payload.email;
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}