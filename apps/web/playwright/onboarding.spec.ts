import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch, createXMTemplateSurvey } from "./utils/helper";
import { organizations } from "./utils/mock";

const { workspaceName } = organizations.onboarding[0];

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
    await createXMTemplateSurvey(page, /NPS/);
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });

  test("link survey", async ({ page, users }) => {
    const user = await users.create({ withoutWorkspace: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/mode/);

    await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();
    await page.getByRole("button", { name: "Link & email surveys" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(workspaceName);
    await page.locator("#form-next-button").click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await expect(page.getByText(workspaceName)).toBeVisible();
  });

  test("website survey", async ({ page, users }) => {
    const user = await users.create({ withoutWorkspace: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/mode/);

    await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();
    await page.getByRole("button", { name: "In-product surveys" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(workspaceName);
    await page.locator("#form-next-button").click();

    await page.getByRole("button", { name: "I will do it later" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await expect(page.getByText(workspaceName)).toBeVisible();
  });
});

test.describe("CX Onboarding", async () => {
  test("first survey creation", async ({ page, users }) => {
    const user = await users.create({ withoutWorkspace: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/mode/);
    await page.getByRole("button", { name: "Formbricks CX Surveys and" }).click();

    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(workspaceName);
    await page.locator("#form-next-button").click();

    await createXMTemplateSurvey(page, /NPS/);
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });
});
