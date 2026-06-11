/**
 * Playwright config for ThermaShift e2e smoke tests.
 *
 * Strategy: tests run against the built dist served by `vite preview`
 * (port 4173 by default). That mirrors production output, avoids
 * dev-server-only quirks (HMR, source maps), and doesn't require a
 * running chat-proxy backend for marketing-site smoke tests.
 *
 * Tests that need backend (chat widget POST, /api/leads/lookup, etc.)
 * default to mocking the network at the route level via page.route().
 *
 * Run locally:
 *   npm run test:e2e:install   # one-time, installs browser binaries
 *   npm run test:e2e           # run all
 *   npm run test:e2e:ui        # interactive runner
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Boot vite preview before tests, kill it after.
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
