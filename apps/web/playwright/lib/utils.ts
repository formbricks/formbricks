import { Page } from "@playwright/test";
import { UsersFixture } from "../fixtures/users";

export async function loginAndGetApiKey(page: Page, users: UsersFixture) {
  const user = await users.create();
  await user.login();

  await page.waitForURL(/\/environments\/[^/]+\/surveys/);

  const environmentId =
    /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
    (() => {
      throw new Error("Unable to parse environmentId from URL");
    })();

  await page.goto(`/environments/${environmentId}/settings/api-keys`);

  await page.getByRole("button", { name: "Add API Key" }).isVisible();
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
  await page.locator(".copyApiKeyIcon").click();

  const apiKey = await page.evaluate("navigator.clipboard.readText()");

  return { environmentId, apiKey };
}
