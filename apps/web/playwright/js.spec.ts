import { expect, test } from "@playwright/test";

import { finishOnboarding, login, replaceEnvironmentIdInHtml, signUpAndLogin } from "./utils/helper";
import { users } from "./utils/mock";

test.describe("JS Package Test", async () => {
  const { name, email, password } = users.js[0];
  let environmentId: string;
  test.describe.configure({ mode: "serial" });

  test("Admin creates an In-App Survey", async ({ page }) => {
    await signUpAndLogin(page, name, email, password);
    await finishOnboarding(page);

    await page
      .getByText("Product ExperienceProduct Market Fit (Superhuman)Measure PMF by assessing how")
      .isVisible();
    await page
      .getByText("Product ExperienceProduct Market Fit (Superhuman)Measure PMF by assessing how")
      .click();

    await page.getByRole("button", { name: "Use this template" }).isVisible();
    await page.getByRole("button", { name: "Use this template" }).click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#howToSendCardTrigger")).toBeVisible();
    await page.locator("#howToSendCardTrigger").click();

    await expect(page.locator("#howToSendCardOption-website")).toBeVisible();
    await page.locator("#howToSendCardOption-website").click();
    await page.locator("#howToSendCardOption-website").click();

    await page.getByRole("button", { name: "Add action" }).click();
    await page.getByText("New SessionGets fired when a").click();
    await page.getByRole("button", { name: "Publish" }).click();

    environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to parse environmentId from URL");
      })();

    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary/);

    expect(page.getByRole("link", { name: "Surveys" })).toBeVisible();
    await page.getByRole("link", { name: "Surveys" }).click();
    await expect(page.getByRole("heading", { name: "Surveys" })).toBeVisible();
  });

  test("JS Display Survey on Page", async ({ page }) => {
    let currentDir = process.cwd();
    let htmlFilePath = currentDir + "/packages/js/index.html";

    let htmlFile = replaceEnvironmentIdInHtml(htmlFilePath, environmentId);
    await page.goto(htmlFile);

    // Formbricks In App Sync has happened
    const syncApi = await page.waitForResponse((response) => response.url().includes("/website/sync"));
    expect(syncApi.status()).toBe(200);

    // Formbricks Modal exists in the DOM
    await expect(page.locator("#formbricks-modal-container")).toHaveCount(1);

    // const displayApi = await page.waitForResponse((response) => response.url().includes("/display"));
    // expect(displayApi.status()).toBe(200);

    // Formbricks Modal is visible
    await expect(
      page.locator("#questionCard-0").getByRole("link", { name: "Powered by Formbricks" })
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
  });

  test("JS submits Response to Survey", async ({ page }) => {
    let currentDir = process.cwd();
    let htmlFilePath = currentDir + "/packages/js/index.html";

    let htmlFile = "file:///" + htmlFilePath;

    await page.goto(htmlFile);

    // Formbricks In App Sync has happened
    const syncApi = await page.waitForResponse((response) => response.url().includes("/website/sync"));
    expect(syncApi.status()).toBe(200);

    // Formbricks Modal exists in the DOM
    await expect(page.locator("#formbricks-modal-container")).toHaveCount(1);

    // Formbricks Modal is visible
    await expect(
      page.locator("#questionCard-0").getByRole("link", { name: "Powered by Formbricks" })
    ).toBeVisible();

    // Fill the Survey
    await page.getByRole("button", { name: "Happy to help!" }).click();
    await page.locator("label").filter({ hasText: "Somewhat disappointed" }).click();
    await page.locator("#questionCard-1").getByRole("button", { name: "Next" }).click();
    await page.locator("label").filter({ hasText: "Founder" }).click();
    await page.locator("#questionCard-2").getByRole("button", { name: "Next" }).click();
    await page
      .locator("#questionCard-3")
      .getByLabel("textarea")
      .fill("People who believe that PMF is necessary");
    await page.locator("#questionCard-3").getByRole("button", { name: "Next" }).click();
    await page.locator("#questionCard-4").getByLabel("textarea").fill("Much higher response rates!");
    await page.locator("#questionCard-4").getByRole("button", { name: "Next" }).click();
    await page.locator("#questionCard-5").getByLabel("textarea").fill("Make this end to end test pass!");
    await page.getByRole("button", { name: "Finish" }).click();
    await page.getByText("Thank you!").click();

    // Formbricks Modal is not visible
    await expect(
      page.locator("#questionCard-6").getByRole("link", { name: "Powered by Formbricks" })
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);
  });

  test("Admin validates Displays & Response", async ({ page }) => {
    await login(page, email, password);

    await page.getByRole("link", { name: "Website Open options Product" }).click();
    (await page.waitForSelector("text=Responses")).isVisible();

    // Survey should have 2 Displays
    await page.waitForTimeout(1000);
    await expect(page.getByText("Impressions2")).toBeVisible();

    // Survey should have 1 Response
    await page.waitForTimeout(1000);
    await expect(page.getByRole("button", { name: "Responses50%" })).toBeVisible();
    await expect(page.getByText("1 Responses", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("CTR50%")).toBeVisible();
    await expect(page.getByText("Somewhat disappointed100%")).toBeVisible();
    await expect(page.getByText("Founder100%")).toBeVisible();
    await expect(page.getByText("People who believe that PMF").first()).toBeVisible();
    await expect(page.getByText("Much higher response rates!").first()).toBeVisible();
    await expect(page.getByText("Make this end to end test").first()).toBeVisible();
  });
});
