process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://flowboard:flowboard@localhost:5433/flowboard_test?schema=public';
// The compose Redis requires a password (default "flowboard"). CI's Redis service
// has none and sets REDIS_URL explicitly, so only apply the default for local runs.
if (!process.env.REDIS_URL && !process.env.REDIS_PASSWORD) {
  process.env.REDIS_PASSWORD = 'flowboard';
}
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
