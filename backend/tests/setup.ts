process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://flowboard:flowboard@localhost:5433/flowboard_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
