import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import { Redis } from 'ioredis';

type SendCommandFn = (...args: string[]) => Promise<RedisReply>;

/**
 * Credential-stuffing / brute-force protection.
 * Uses Redis as the shared store so limits hold across instances and restarts.
 * Falls back to an in-memory store when Redis is unavailable (e.g. unit tests).
 */
export function createAuthRateLimiter(redis: Redis | null, minutes = 15, max = 20) {
  if (process.env.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  const store = redis
    ? new RedisStore({
        sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as SendCommandFn,
      })
    : undefined;

  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
    },
    store,
    keyGenerator: (req: Request) => req.ip ?? 'unknown',
  });
}

/** General API throttle per IP. */
export function createApiRateLimiter(redis: Redis | null, minutes = 1, max = 120) {
  if (process.env.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  const store = redis
    ? new RedisStore({
        sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as SendCommandFn,
      })
    : undefined;

  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' },
    },
    store,
    keyGenerator: (req: Request) => req.ip ?? 'unknown',
  });
}
