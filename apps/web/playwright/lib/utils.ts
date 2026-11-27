import { Page } from "@playwright/test";

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
