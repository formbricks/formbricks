import { expect, test } from "@playwright/test";

import { signUpAndLogin } from "./utils/helper";
import { teams, users } from "./utils/mock";

const { productName } = teams.onboarding[0];

test.describe("Onboarding Flow Test", async () => {
  test("link survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[0];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL("/onboarding");
    await expect(page).toHaveURL("/onboarding");

    await page.getByRole("button", { name: "Link Surveys Create a new" }).click();
    await page.frameLocator("iframe").locator("label").filter({ hasText: "Work 💼" }).click();
    await page.frameLocator("iframe").getByRole("button", { name: "Next" }).click();
    await page.frameLocator("iframe").locator("label").filter({ hasText: "Conduct reserach" }).click();
    await page.frameLocator("iframe").getByRole("button", { name: "Next" }).click();
    await page.frameLocator("iframe").locator("label").filter({ hasText: "GitHub" }).click();
    await page.frameLocator("iframe").getByRole("button", { name: "Finish" }).click();
    await page.getByRole("button", { name: "Collect Feedback Collect" }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Save" }).click();
  });

  test("In app survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[1];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL("/onboarding");
    await expect(page).toHaveURL("/onboarding");
    await page.getByRole("button", { name: "In-app Surveys Run a survey" }).click();
    await page.locator("label").filter({ hasText: "Engineer" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("label").filter({ hasText: "Improve user retention" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "I am not sure how to do this" }).click();
    await page.locator("input").click();
    await page.locator("input").fill("test@gmail.com");
    await page.getByRole("button", { name: "Invite" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });
});
