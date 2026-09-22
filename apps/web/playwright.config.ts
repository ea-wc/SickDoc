import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a real PostgreSQL database and the compiled apps.
 *
 * Prerequisites (the root `pnpm test:e2e` script builds for you):
 *   pnpm build        # build shared, api (dist/main.js), web (.next)
 *   pnpm db:migrate   # apply Prisma migrations once (schema must exist)
 *
 * `globalSetup` applies migrations and re-seeds, then Playwright starts the
 * compiled API and the production web server before running the specs.
 */
const PORT = 3000;
const API_PORT = 3001;
const DEMO_UI = process.env.DEMO_UI === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Show the browser when running the UI demo (`test:e2e:demo`).
    headless: !DEMO_UI,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "../api",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm start -p ${PORT}`,
      cwd: ".",
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      // The demo spec is a slow, headed tour — keep it out of the regular suite.
      testIgnore: /demo/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "demo",
      testMatch: /demo/,
      use: { ...devices["Desktop Chrome"], actionTimeout: 30_000 },
    },
  ],
});
