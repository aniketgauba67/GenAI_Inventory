/******************************** playwright.config.ts ***************************************
 *
 *  Module: Playwright Configuration
 *
 *  This module configures browser-based end-to-end tests.
 *
 *  The module provides:
 *
 *  - Playwright project settings for desktop and mobile browsers.
 *  - automatic Next.js dev server startup for e2e execution.
 *  - retry, trace, screenshot, and video settings for debugging failures.
 *
 *  Key Structures Used:
 *
 *  - Playwright defineConfig, browser device profiles, and webServer settings.
 *
 *  This module ensures:
 *
 *  - user workflows are validated in real browser contexts.
 *  - CI can reproduce frontend e2e behavior from a clean checkout.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { defineConfig, devices } from "@playwright/test";

const localSlowMo = Number(process.env.PLAYWRIGHT_SLOW_MO_MS ?? "350");

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
    headless: Boolean(process.env.CI),
    launchOptions: {
      slowMo: process.env.CI ? 0 : localSlowMo,
    },
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
