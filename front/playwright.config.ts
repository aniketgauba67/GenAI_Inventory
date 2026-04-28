import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for end-to-end tests.
 *
 * Run:  npx playwright test          (requires dev server running)
 *       npx playwright test --ui     (interactive mode)
 *
 * The config starts the Next.js dev server automatically before running tests.
 */

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",

  // Limit parallelism to avoid race conditions on a single local machine
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,

  // Shared settings for all projects (browsers)
  use: {
    // Dev server URL — the tests assume the Next.js app is running here
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],

  // Start the Next.js development server before running tests
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
