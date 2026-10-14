import { chromium, expect as playwrightExpect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.argv[2];
assert.ok(origin, "Usage: node docker/smoke-next-browser.mjs <origin>");
const timeout = 60_000;
const expect = playwrightExpect.configure({ timeout });
const started = performance.now();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ locale: "en-US" });
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);
  const failures = [];
  let scripts = 0;
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/_next/static/")) failures.push(`Asset request failed: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (!response.url().includes("/_next/static/")) return;
    if (!response.ok()) failures.push(`Asset HTTP ${response.status()}: ${response.url()}`);
    if (response.request().resourceType() === "script") scripts++;
  });
  // Starting at / proves that client-side redirects also execute, as on Apollo's blank page.
  await page.goto(origin, { waitUntil: "load", timeout });
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByRole("button", { name: "Log in with Email", exact: true }).click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  // SSR markup alone cannot pass this: the password toggle needs the client runtime to hydrate.
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("type", "text");
  await page.getByRole("link", { name: "Forgot your password?", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/forgot-password/);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  assert.ok(scripts > 0, "Browser did not load Next scripts");
  assert.deepEqual(failures, [], "Browser startup or asset loading failed");
  console.log(
    JSON.stringify({
      status: "passed",
      scripts,
      durationMs: Math.round(performance.now() - started),
      journeys: ["login hydration", "password recovery navigation"],
    })
  );
} finally {
  await browser.close();
}
