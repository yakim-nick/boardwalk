module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  globalSetup: '<rootDir>/tests/global-setup.ts',
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
  // Floor just under the measured baseline (Nov 2026: ~69% statements, ~49% branches)
  // so coverage cannot silently drop. Raise it as tests are added.
  coverageThreshold: {
    global: { statements: 65, branches: 45, functions: 65, lines: 65 },
  },
  testTimeout: 30000,
};
