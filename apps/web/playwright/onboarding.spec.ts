import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch, createXMTemplateSurvey } from "./utils/helper";

test.describe("Onboarding Flow Test", async () => {
  test("start from scratch", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/survey/);
    await createSurveyFromScratch(page, { mode: "cx" });
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });

  test("use template", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/survey/);
    await page.getByRole("button", { name: "Use a template" }).click();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/templates/);
    await createXMTemplateSurvey(page, "NPS Net Promoter Score");
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });
});
