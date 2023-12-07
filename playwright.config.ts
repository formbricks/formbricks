import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./apps/web/playwright",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.PLAYWRIGHT_CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.PLAYWRIGHT_CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: "Mobile Chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
    // {
    //   name: "Mobile Safari",
    //   use: { ...devices["iPhone 12"] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: "Microsoft Edge",
    //   use: { ...devices["Desktop Edge"], channel: "msedge" },
    // },
    // {
    //   name: "Google Chrome",
    //   use: { ...devices["Desktop Chrome"], channel: "chrome" },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev --filter=web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.PLAYWRIGHT_CI,
    env: {
      WEBAPP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public",
      NEXTAUTH_SECRET: "luJthrnoDpVgGakjVYlccsZ1FdlwxIWogWIsrxzoQ6E=",
      NEXTAUTH_URL: "http://localhost:3000",
      EMAIL_VERIFICATION_DISABLED: "1",
      PASSWORD_RESET_DISABLED: "1",
      INVITE_DISABLED: "1",
      ENCRYPTION_KEY: "b19a492fe2a9c01debe543f945d8481728e126904f5b54acc53eb0936748fb02",
      PLAYWRIGHT_CI: "true",
    },
    // reuseExistingServer: true,
    timeout: 60000 * 10,
  },
});
