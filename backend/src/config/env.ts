/**
 * Environment configuration.
 *
 * All configuration is loaded from `process.env` once at bootstrap and
 * validated eagerly so misconfiguration fails fast instead of at request time.
 */

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
  redisUrl: string;
  corsOrigin: string;
  logLevel: string;
}

/** Known placeholder JWT secrets that must never be used in production. */
const WEAK_SECRETS = new Set([
  'change-me-to-a-long-random-secret',
  'change-me-before-deploying',
  'dev-only-change-me',
  'test-secret',
  'test-secret-not-for-production',
  'ci-test-secret',
]);

/** Returns `value` or throws a descriptive error naming the missing variable. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Refuses to boot in production with a known placeholder or a too-short
 * secret, since such secrets make JWT forging trivial.
 */
function assertStrongSecret(secret: string, nodeEnv: string): void {
  if (nodeEnv !== 'production') return;
  if (WEAK_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      `JWT_SECRET is weak or is a known placeholder. Generate a strong secret with: ` +
        `openssl rand -hex 64`
    );
  }
}

/** Loads and validates configuration, optionally overriding fields (used by tests). */
export function loadEnv(overrides: Partial<Env> = {}): Env {
  const nodeEnv = (process.env.NODE_ENV as Env['nodeEnv']) || 'development';
  const jwtSecret = required('JWT_SECRET', process.env.JWT_SECRET);
  assertStrongSecret(jwtSecret, nodeEnv);

  const redisUrl = buildRedisUrl(process.env.REDIS_URL, process.env.REDIS_PASSWORD);

  const env: Env = {
    nodeEnv,
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT || 4000),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
    redisUrl,
    corsOrigin: process.env.CORS_ORIGIN || '*',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
  return { ...env, ...overrides };
}

/**
 * Builds a Redis connection string that embeds the password
 * (`redis://:password@host:port`) when a password is configured, while
 * reusing the host/port portion of an already-supplied URL.
 */
function buildRedisUrl(url: string | undefined, password: string | undefined): string {
  if (!url) return 'redis://localhost:6379';
  if (!password) return url;
  // Drop the scheme and any existing userinfo, then prefix the password.
  const bare = url.replace(/^redis:\/\//, '').replace(/^[^@]*@/, '');
  return `redis://:${encodeURIComponent(password)}@${bare}`;
}
