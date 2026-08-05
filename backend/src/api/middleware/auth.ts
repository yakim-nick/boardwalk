import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../domain/services/auth.service';
import { UnauthorizedError } from '../../domain/errors';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(auth: AuthService) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const payload = await auth.verifyToken(header.slice(7));
      req.userId = payload.sub;
      req.userEmail = payload.email;
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}
