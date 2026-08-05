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

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await this.auth.register(input);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = loginSchema.parse(req.body);
      const result = await this.auth.login(input);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req as Request & { userId: string };
      const user = await this.auth.getPublicUser(userId);
      if (!user) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
      }
      res.json({ data: { user } });
    } catch (err) {
      next(err);
    }
  };
}
