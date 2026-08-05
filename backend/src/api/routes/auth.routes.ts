import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { createAuthRateLimiter } from '../middleware/rate-limiter';
import { Redis } from 'ioredis';
import { requireAuth } from '../middleware/auth';
import { AuthService } from '../../domain/services/auth.service';

export function createAuthRouter(auth: AuthService, redis: Redis | null): Router {
  const router = Router();
  const controller = new AuthController(auth);

  router.post('/register', createAuthRateLimiter(redis, 60, 10), controller.register);
  router.post('/login', createAuthRateLimiter(redis, 15, 20), controller.login);
  router.get('/me', requireAuth(auth), controller.me);

  return router;
}
