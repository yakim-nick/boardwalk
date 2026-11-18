import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../../domain/services/auth.service';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('A valid email is required').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

const loginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * Express error middleware instead of crashing the process.
 */
function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

/** HTTP handlers for the auth endpoints. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /auth/register — creates an account and returns a token. */
  register = asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await this.auth.register(input);
    res.status(201).json({ data: result });
  });

  /** POST /auth/login — exchanges credentials for a token. */
  login = asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await this.auth.login(input);
    res.json({ data: result });
  });

  /** GET /auth/me — returns the currently authenticated user. */
  me = asyncHandler(async (req, res) => {
    const { userId } = req as Request & { userId: string };
    const user = await this.auth.getPublicUser(userId);
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ data: { user } });
  });
}
