import { Page, expect } from "@playwright/test";
import { UsersFixture } from "../fixtures/users";
import { clickUntilVisible } from "../utils/click-until";

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

  // Old workspace-scoped org settings URL is redirected to the org-scoped API keys route.
  await page.goto(`/workspaces/${workspaceId}/settings/organization/api-keys`, {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Add API Key" }).waitFor({ state: "visible", timeout: 15000 });
  // The page was read at `domcontentloaded`, before it hydrates: a single click can land on the
  // server-rendered button and open nothing.
  const apiKeyLabel = page.getByPlaceholder("e.g. GitHub, PostHog, Slack");
  await clickUntilVisible(page.getByRole("button", { name: "Add API Key" }), apiKeyLabel);
  await apiKeyLabel.fill("E2E Test API Key");
  await page.getByTestId("add_permission__button__test").click();
  await page.locator("#workspace-permission-select-0").click();
  await page.getByRole("option", { name: "Manage", exact: true }).click();
  await page.getByTestId("organization-access-accessControl-read").click();
  await page.getByTestId("organization-access-accessControl-write").click();
  await page.getByRole("button", { name: "Add API Key" }).click();

  // The new key is listed, once, only after the server has stored it. It is read from the page rather
  // than through the copy button: parallel workers can share one clipboard, so another test's copy could
  // land in between. The assertion compares a boolean, so a failure never prints the key.
  const shownKey = page.getByTestId("api-key-value").first();
  await expect(shownKey).toBeVisible({ timeout: 30_000 });
  const apiKey = (await shownKey.innerText()).trim();
  expect(apiKey.startsWith("fbk_"), "the new API key is shown").toBe(true);

  return { workspaceId, apiKey };
}
