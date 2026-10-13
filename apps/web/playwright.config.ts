import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests (pnpm test:e2e). The app runs with `next dev` (the dev-only code banner is how the
 * specs read sign-in codes) against an in-memory MongoDB started by tests/e2e/server.ts.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  // One shared server and database; specs use unique phone numbers/emails so they don't collide.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm exec tsx tests/e2e/server.ts",
    // Ready once the app answers and its database is up.
    url: `http://localhost:${PORT}/api/v1/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT) },
  },
});
