import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import { Redis } from 'ioredis';

type SendCommandFn = (...args: string[]) => Promise<RedisReply>;

/** No-op middleware used in tests so rate limits never interfere. */
function noopMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * Builds a Redis-backed store for `express-rate-limit`, or `undefined` when
 * Redis is unavailable so the limiter falls back to its in-memory store.
 */
function createRedisStore(redis: Redis | null): RedisStore | undefined {
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: ((...args: string[]) => redis.call(args[0], ...args.slice(1))) as SendCommandFn,
  });
}

/**
 * Factory for an IP-based rate limiter.
 * Uses Redis as the shared store so limits hold across instances and restarts;
 * disabled entirely under `NODE_ENV=test`.
 */
function createRateLimiter(redis: Redis | null, minutes: number, max: number, message: string) {
  if (process.env.NODE_ENV === 'test') {
    return noopMiddleware;
  }

  return rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message },
    },
    store: createRedisStore(redis),
    keyGenerator: (req: Request) => req.ip ?? 'unknown',
  });
}

/**
 * Credential-stuffing / brute-force protection for auth endpoints.
 * Stricter than the general API throttle (fewer requests per window).
 */
export function createAuthRateLimiter(redis: Redis | null, minutes = 15, max = 20) {
  return createRateLimiter(redis, minutes, max, 'Too many attempts, please try again later');
}

/** General API throttle per IP. */
export function createApiRateLimiter(redis: Redis | null, minutes = 1, max = 120) {
  return createRateLimiter(redis, minutes, max, 'Too many requests, slow down');
}
