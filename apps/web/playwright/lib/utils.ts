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

  await page.goto(`/environments/${environmentId}/project/api-keys`);

  await page.getByRole("button", { name: "Add Production API Key" }).isVisible();
  await page.getByRole("button", { name: "Add Production API Key" }).click();
  await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill("E2E Test API Key");
  await page.getByRole("button", { name: "Add API Key" }).click();
  await page.locator(".copyApiKeyIcon").click();

  const apiKey = await page.evaluate("navigator.clipboard.readText()");

  return { environmentId, apiKey };
}
