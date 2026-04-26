import { defineConfig, devices } from "@playwright/test";
import { TEST_DB_URL, TEST_DB_URL_UNPOOLED } from "./e2e/constants";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  // Next.js dev mode compiles pages on demand; give each test enough time.
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    // Allow individual actions (fill, click, goto) more time during cold start.
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.spec\.ts/,
    },
    {
      name: "chromium-noauth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Push schema to test DB (idempotent, no migration files needed)
    command: "npx prisma db push --accept-data-loss && npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DB_URL,
      DATABASE_URL_UNPOOLED: TEST_DB_URL_UNPOOLED,
    },
  },
  globalSetup: "./e2e/global-setup.ts",
});
