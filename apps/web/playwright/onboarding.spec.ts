import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { organizations } from "./utils/mock";

const { projectName } = organizations.onboarding[0];

test.describe("Onboarding Flow Test", async () => {
  test("link survey", async ({ page, users }) => {
    const user = await users.create({ withoutProject: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/projects\/new\/mode/);

    await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();
    await page.getByRole("button", { name: "Link & email surveys" }).click();
    // await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(projectName);
    await page.locator("#form-next-button").click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test("website survey", async ({ page, users }) => {
    const user = await users.create({ withoutProject: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/projects\/new\/mode/);

    await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();
    await page.getByRole("button", { name: "In-product surveys" }).click();
    // await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(projectName);
    await page.locator("#form-next-button").click();

    await page.getByRole("button", { name: "I'll do it later" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(projectName)).toBeVisible();
  });
});

test.describe("CX Onboarding", async () => {
  test("first survey creation", async ({ page, users }) => {
    const user = await users.create({ withoutProject: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/projects\/new\/mode/);
    await page.getByRole("button", { name: "Formbricks CX Surveys and" }).click();

    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(projectName);
    await page.locator("#form-next-button").click();

    await page.getByRole("button", { name: "NPS Implement proven best" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit(\?.*)mode=cx$/);
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });
});
