import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for Adaptive Fitness (Expo Web)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // Deterministic sequential runs to protect local storage & state
  retries: 0,
  timeout: 90000,
  expect: {
    timeout: 10000,
  },
  reporter: [
    ['list'],
    ['./e2e/helpers/qaReporter.ts'],
  ],
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 390, height: 844 }, // Mobile viewport (iPhone 14/15)
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
