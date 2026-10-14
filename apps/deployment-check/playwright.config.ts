import { defineConfig, devices } from "@playwright/test";

const reportDir = process.env.REPORT_DIR ?? "report";

// One worker, no retries: the checks are ordered (tiers) and a retry would hide a flaky deployment,
// which is exactly what an operator running this wants to see.
export default defineConfig({
  testDir: "./checks",
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  outputDir: `${reportDir}/artifacts`,
  globalSetup: "./checks/global-setup.ts",
  globalTeardown: "./checks/global-teardown.ts",
  reporter: [
    ["./src/reporter.ts"],
    ["html", { outputFolder: `${reportDir}/html`, open: "never" }],
    ["junit", { outputFile: `${reportDir}/junit.xml` }],
  ],
  use: {
    // The API key never reaches the browser, so a trace of the survey page cannot leak it.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
