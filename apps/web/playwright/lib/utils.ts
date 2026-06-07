import { Page } from "@playwright/test";
import { UsersFixture } from "../fixtures/users";

type WorkspaceSurveyLocation = {
  workspaceId: string;
  isSurveyList: boolean;
};

const getWorkspaceSurveyLocation = (url: URL): WorkspaceSurveyLocation | null => {
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length !== 2 && segments.length !== 3) {
    return null;
  }

  if (segments[0] !== "workspaces") {
    return null;
  }

  const workspaceId = segments[1];

  if (!workspaceId) {
    return null;
  }

  if (segments.length === 2) {
    return {
      workspaceId,
      isSurveyList: false,
    };
  }

  if (segments[2] !== "surveys") {
    return null;
  }

  return {
    workspaceId,
    isSurveyList: true,
  };
};

const SURVEY_EDITOR_URL = /\/workspaces\/[^/]+\/surveys\/[^/]+\/edit(\?.*)?$/;
const ONBOARDING_SURVEY_URL = /\/organizations\/[^/]+\/workspaces\/new\/survey(\?.*)?$/;

export async function startSurveyFromScratch(
  page: Page,
  options?: { waitForEditUrl?: RegExp }
): Promise<void> {
  const editUrlPattern = options?.waitForEditUrl ?? SURVEY_EDITOR_URL;

  if (ONBOARDING_SURVEY_URL.test(page.url())) {
    await page.getByRole("button", { name: "Start from scratch" }).click();
    await page.waitForURL(editUrlPattern);
    return;
  }

  const createSurveyButton = page.getByRole("button", { name: "Create survey", exact: true });

  if (await createSurveyButton.isVisible().catch(() => false)) {
    await createSurveyButton.click();
    await page.waitForURL(editUrlPattern);
    return;
  }

  const emptyStateCard = page.getByRole("button", { name: /Start from scratch/i }).first();

  if (await emptyStateCard.isVisible().catch(() => false)) {
    await emptyStateCard.click();
    await createSurveyButton.waitFor({ state: "visible" });
    await createSurveyButton.click();
    await page.waitForURL(editUrlPattern);
    return;
  }

  await page.getByRole("button", { name: "New Survey" }).click();
  await page.getByRole("menuitem", { name: "Start from scratch" }).click();
  await page.waitForURL(editUrlPattern);
}

export async function gotoSurveyTemplates(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/surveys/templates`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/templates/);
  await page.getByRole("heading", { name: /Create a new survey/i }).waitFor({ state: "visible" });
}

export async function gotoSurveyList(page: Page): Promise<string> {
  await page.waitForURL((url) => getWorkspaceSurveyLocation(url) !== null, { timeout: 30000 });

  const currentUrl = new URL(page.url());
  const location = getWorkspaceSurveyLocation(currentUrl);

  if (!location) {
    throw new Error(`Unable to determine workspaceId from URL: ${page.url()}`);
  }

  const { workspaceId, isSurveyList } = location;

  if (!isSurveyList) {
    await page.goto(`/workspaces/${workspaceId}/surveys`, { waitUntil: "domcontentloaded" });
  }

  await page.waitForURL((url) => getWorkspaceSurveyLocation(url)?.isSurveyList === true, {
    timeout: 30000,
  });

  return workspaceId;
}

export async function loginAndGetApiKey(page: Page, users: UsersFixture) {
  const user = await users.create();
  await user.login();

  await page.waitForURL(/\/workspaces\/[^/]+\/surveys/, { timeout: 30000 });

  const workspaceId =
    /\/workspaces\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
    (() => {
      throw new Error("Unable to parse workspaceId from URL");
    })();

  await page.goto(`/workspaces/${workspaceId}/settings/organization/api-keys`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Add API Key" }).waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: "Add API Key" }).click();
  await page.getByPlaceholder("e.g. GitHub, PostHog, Slack").fill("E2E Test API Key");
  await page.getByTestId("add_permission__button__test").click();
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

  return { workspaceId, apiKey };
}
