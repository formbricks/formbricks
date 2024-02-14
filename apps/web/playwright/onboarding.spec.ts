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

    await page.getByText("ImageLink SurveysCreate a new").click();
    await page.waitForURL("/onboarding/link/survey");
    await page.frameLocator("iframe").locator("span").filter({ hasText: "Work 💼" }).first().click();
    await page.frameLocator("iframe").getByRole("button", { name: "Next" }).click();
    await page.frameLocator("iframe").locator("span").filter({ hasText: "Conduct reserach" }).first().click();
    await page.frameLocator("iframe").getByRole("button", { name: "Next" }).click();
    await page
      .frameLocator("iframe")
      .locator("label")
      .filter({ hasText: "Recommendation (e.g. coworker" })
      .click();
    await page.frameLocator("iframe").getByRole("button", { name: "Finish" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await page.locator(".relative > svg").first().click();
    await expect(page.getByText(productName)).toBeVisible();
  });

  test("In app survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[1];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL("/onboarding");
    await expect(page).toHaveURL("/onboarding");

    await page.getByText("ImageIn app surveysRun a").click();
    await page.waitForURL("/onboarding/inApp/survey");
    await page.frameLocator("iframe").locator("label").filter({ hasText: "Engineer" }).click();
    await page.frameLocator("iframe").getByRole("button", { name: "Next" }).click();
    await page.frameLocator("iframe").locator("label").filter({ hasText: "Increase conversion" }).click();
    await page.frameLocator("iframe").getByRole("button", { name: "Finish" }).click();

    await page.goto("/onboarding/inApp/connect");
    await page.waitForURL("/onboarding/inApp/connect");

    await page.goto("/onboarding/inApp/inviteTeamMate");
    await page.waitForURL("/onboarding/inApp/inviteTeamMate");

    await page.getByRole("button", { name: "I want to have a look around" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await page.locator(".relative > svg").first().click();
    await expect(page.getByText(productName)).toBeVisible();
  });
});
