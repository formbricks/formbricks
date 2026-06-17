import { expect } from "playwright/test";
import { test } from "./lib/fixtures";

/**
 * ENG-969 — Allow changing survey status from the survey list context menu.
 *
 * The fixture seeds a draft survey for the new user, so we publish it via the
 * v3 API before exercising the context menu. Each block must have an `id`,
 * each element must have an `id`, and i18n keys must be the default locale
 * ("en-US").
 */

const SEED_BLOCK_ID = "k1q1q1q1q1q1q1q1q1q1q1q1";
const SEED_ELEMENT_ID = "e1q1q1q1q1q1q1q1q1q1q1q1";

async function createSurveyViaApi(
  page: import("playwright").Page,
  workspaceId: string,
  name: string
): Promise<string> {
  const body = {
    workspaceId,
    type: "link",
    name,
    blocks: [
      {
        id: SEED_BLOCK_ID,
        name: "Block 1",
        elements: [
          {
            id: SEED_ELEMENT_ID,
            type: "openText",
            headline: { "en-US": "Q?" },
            required: false,
            longAnswer: false,
            inputType: "text",
            placeholder: { "en-US": "A" },
            charLimit: { enabled: false },
          },
        ],
      },
    ],
    endings: [],
    welcomeCard: { enabled: false },
  };
  const id = await page.evaluate(async (b) => {
    const r = await fetch("/api/v3/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
    const json = await r.json();
    return json.data.id as string;
  }, body);
  return id;
}

async function patchStatusViaApi(
  page: import("playwright").Page,
  surveyId: string,
  status: "draft" | "inProgress" | "paused" | "completed"
) {
  await page.evaluate(
    async ({ id, s }) => {
      await fetch(`/api/v3/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: s }),
      });
    },
    { id: surveyId, s: status }
  );
}

test.describe("ENG-969 survey list status context menu", () => {
  test.setTimeout(60_000);

  test("happy path: change status from In Progress -> Paused", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();
    const workspaceId = user.workspaceId!;
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyViaApi(page, workspaceId, "ENG-969 In Progress Survey");
    await patchStatusViaApi(page, surveyId, "inProgress");
    await page.goto(`/workspaces/${workspaceId}/surveys`);

    // Open the context menu for that survey.
    await page.locator('[data-testid="survey-dropdown-trigger"]').first().click();
    // AC1: change status submenu visible.
    await expect(page.getByTestId("survey-status-submenu")).toBeVisible();
    await page.getByTestId("survey-status-submenu").click();
    // AC2: current status is reflected (In Progress is checked).
    await expect(page.getByTestId("survey-status-option-inProgress")).toHaveAttribute("aria-checked", "true");
    // Use keyboard to dodge a Radix submenu/pointer-intercept flake.
    await page.getByTestId("survey-status-submenu").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown"); // moves from In Progress -> Paused
    await page.keyboard.press("Enter");

    // AC3: menu closes immediately.
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
    // AC4: loading toast appears.
    await expect(page.getByRole("status").filter({ hasText: "Updating survey status" })).toBeVisible();
    // AC5: success toast appears.
    await expect(
      page.getByRole("status").filter({ hasText: "Survey status updated successfully" })
    ).toBeVisible();

    // AC: list reflects the new status without a manual page reload.
    await expect(page.getByRole("link", { name: /ENG-969 In Progress Survey.*Paused/ })).toBeVisible();
  });

  test("error path: backend 500 -> error toast, optimistic state rolls back", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();
    const workspaceId = user.workspaceId!;
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyViaApi(page, workspaceId, "ENG-969 Error Survey");
    await patchStatusViaApi(page, surveyId, "inProgress");
    await page.goto(`/workspaces/${workspaceId}/surveys`);

    // Intercept the PATCH to simulate a server error.
    await page.route(`**/api/v3/surveys/${surveyId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            title: "Server Error",
            status: 500,
            detail: "Synthetic failure for verifier",
            code: "internal_server_error",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.locator('[data-testid="survey-dropdown-trigger"]').first().click();
    await page.getByTestId("survey-status-submenu").click();
    await page.getByTestId("survey-status-submenu").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // AC6: error toast surfaces server message (not "something went wrong").
    await expect(
      page.getByRole("status").filter({ hasText: "Synthetic failure for verifier" })
    ).toBeVisible();
    // Optimistic state rolls back — row still shows In Progress.
    await expect(page.getByRole("link", { name: /ENG-969 Error Survey.*In Progress/ })).toBeVisible();
  });

  test("draft survey: change-status submenu is hidden", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();
    const workspaceId = user.workspaceId!;
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    // Create a draft survey (default status from POST is "draft").
    await createSurveyViaApi(page, workspaceId, "ENG-969 Draft Survey");
    await page.goto(`/workspaces/${workspaceId}/surveys`);

    await page.locator('[data-testid="survey-dropdown-trigger"]').first().click();
    // AC8: no "change status" submenu for draft surveys.
    await expect(page.getByTestId("survey-status-submenu")).toHaveCount(0);
    // Edit / Duplicate / Delete still available.
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  });
});
