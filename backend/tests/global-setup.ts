import { execSync } from 'child_process';
import path from 'path';

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://flowboard:flowboard@localhost:5433/flowboard_test?schema=public';

export default function globalSetup(): void {
  process.env.DATABASE_URL = testDbUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
  process.env.NODE_ENV = 'test';

  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });
}
