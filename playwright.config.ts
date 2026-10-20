import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require("dotenv").config({ path: ".env" });

/**
 * PW_WORKERS (the E2E_WORKERS repository variable in e2e.yml) overrides the worker count. Playwright
 * turns an unparseable value into "NaN workers", runs no tests and exits 0, which would turn the required
 * E2E check green, so anything but a positive integer or a percentage (`8`, `50%`) fails here instead.
 */
const parseWorkers = (raw: string | undefined): number | string | undefined => {
  if (!raw) return undefined;
  if (!/^[1-9]\d*%?$/.test(raw)) {
    throw new Error(`PW_WORKERS must be a positive integer or a percentage like "50%", got "${raw}".`);
  }
  return raw.endsWith("%") ? raw : Number(raw);
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./apps/web/playwright",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Timeout for each test */
  timeout: 120000,
  /* Fail the test run after the first failure */
  maxFailures: process.env.CI ? undefined : 1, // Allow more failures in CI to avoid cascading shutdowns
  /* On CI use one worker per CPU. The app, Postgres and the other services share the runner, so
     going above one per core only adds contention; 4 workers on the 4 vCPU GitHub runner and 8 on
     an 8 vCPU runner both measured well. PW_WORKERS overrides it (see parseWorkers above). */
  workers: parseWorkers(process.env.PW_WORKERS) ?? (process.env.CI ? "100%" : undefined),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  /* Shared settings for all the workspaces below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    permissions: ["clipboard-read", "clipboard-write"],
    screenshot: "only-on-failure", // Capture screenshots only on test failure
    video: "retain-on-failure", // Optionally record video on failure
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/*.spec.ts",
      grepInvert: /@timing/,
    },

    /* Latency-comparison tests (@timing) measure sub-100ms differences, so they must not share the
       machine with the parallel suite: with 4 workers on the app's own vCPUs the measurement is
       noise. Depending on "chromium" makes this project start only once that one has finished.
       Dependency projects ignore CLI file and grep filters, so `pnpm test:e2e security.spec.ts` or
       `--project=chromium-timing` runs the whole chromium project first; add `--no-deps` to run only
       the timing test. */
    {
      name: "chromium-timing",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/*.spec.ts",
      grep: /@timing/,
      dependencies: ["chromium"],
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
});
