import { defineConfig } from '@playwright/test';

/**
 * End-to-end suite. Runs against a production build (`npm run build` first)
 * with a fresh, isolated database seeded from the synthetic fixtures
 * (global-setup wipes and reseeds data/e2e.db on every run).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1, // tests share one seeded database; state transitions are ordered
  retries: 0,
  timeout: 45_000,
  globalSetup: './tests/e2e/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx next start apps/web -p 3100',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_PATH: './data/e2e-pg',
      AUTH_SECRET: 'e2e-secret-not-for-production',
      AI_PROVIDER: 'mock',
      DATA_CLASSIFICATION: 'SYNTHETIC',
      ANALYSE_RATE_LIMIT: '100', // the limiter has its own unit tests; e2e exercises workflows
    },
  },
});
