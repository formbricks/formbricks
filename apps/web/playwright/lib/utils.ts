import { Page } from "@playwright/test";
import { UsersFixture } from "../fixtures/users";

type EnvironmentSurveyLocation = {
  environmentId: string;
  isSurveyList: boolean;
};

const getEnvironmentSurveyLocation = (url: URL): EnvironmentSurveyLocation | null => {
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length !== 2 && segments.length !== 3) {
    return null;
  }

  if (segments[0] !== "environments") {
    return null;
  }

  const environmentId = segments[1];

  if (!environmentId) {
    return null;
  }

  if (segments.length === 2) {
    return {
      environmentId,
      isSurveyList: false,
    };
  }

  if (segments[2] !== "surveys") {
    return null;
  }

  return {
    environmentId,
    isSurveyList: true,
  };
};

export async function gotoSurveyList(page: Page): Promise<string> {
  await page.waitForURL((url) => getEnvironmentSurveyLocation(url) !== null, { timeout: 30000 });

  const currentUrl = new URL(page.url());
  const location = getEnvironmentSurveyLocation(currentUrl);

  if (!location) {
    throw new Error(`Unable to determine environmentId from URL: ${page.url()}`);
  }

  const { environmentId, isSurveyList } = location;

  if (!isSurveyList) {
    await page.goto(`/environments/${environmentId}/surveys`, { waitUntil: "domcontentloaded" });
  }

  await page.waitForURL((url) => getEnvironmentSurveyLocation(url)?.isSurveyList === true, {
    timeout: 30000,
  });

  return environmentId;
}

export async function loginAndGetApiKey(page: Page, users: UsersFixture) {
  const user = await users.create();
  await user.login();

  const environmentId = await gotoSurveyList(page);

  await page.goto(`/environments/${environmentId}/settings/api-keys`, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Add API Key" }).waitFor({ state: "visible", timeout: 15000 });
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
  // Use longer timeouts for cloud environments with high concurrency and network latency
  // Wait for network idle to ensure the API key is fully committed to the database
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  await page.waitForSelector(".copyApiKeyIcon", { state: "visible", timeout: 30000 });

  // Add a delay to ensure the API key is fully committed to the database
  // This is especially important with high concurrency in cloud environments
  await page.waitForTimeout(2000);

  await page.locator(".copyApiKeyIcon").first().click();

  const apiKey = (await page.evaluate("navigator.clipboard.readText()")) as string;

  return { environmentId, apiKey };
}
