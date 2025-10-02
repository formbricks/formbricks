import { Page } from "@playwright/test";
import { UsersFixture } from "../fixtures/users";

export async function loginAndGetApiKey(page: Page, users: UsersFixture) {
  const user = await users.create();
  await user.login();

  await page.waitForURL(/\/environments\/[^/]+\/surveys/, { timeout: 30000 });

  const environmentId =
    /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
    (() => {
      throw new Error("Unable to parse environmentId from URL");
    })();

  await page.goto(`/environments/${environmentId}/settings/api-keys`, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Add API Key" }).waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "Add API Key" }).click();
  await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill("E2E Test API Key");
  await page.getByRole("button", { name: "+ Add permission" }).click();
  await page.getByRole("button", { name: "development" }).click();
  await page.getByRole("menuitem", { name: "production" }).click();
  await page.getByRole("button", { name: "read" }).click();
  await page.getByRole("menuitem", { name: "manage" }).click();
  await page.getByTestId("organization-access-accessControl-read").click();
  await page.getByTestId("organization-access-accessControl-write").click();
  await page.getByRole("button", { name: "Add API Key" }).click();

  // Wait for the API key creation to complete and appear in the list
  // Use a much longer timeout for cloud environments with high concurrency (20 workers)
  // Also wait for network idle to ensure the API key is fully committed to the database
  await page.waitForLoadState("networkidle", { timeout: 20000 });
  await page.waitForSelector(".copyApiKeyIcon", { state: "visible", timeout: 20000 });

  // Add a small delay to ensure the API key is committed to the database
  await page.waitForTimeout(1000);

  await page.locator(".copyApiKeyIcon").first().click();

  const apiKey = await page.evaluate("navigator.clipboard.readText()");

  return { environmentId, apiKey };
}
