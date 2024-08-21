import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { replaceEnvironmentIdInHtml } from "./utils/helper";

test.describe("JS Package Test", async () => {
  let environmentId: string;

  test("Tests", async ({ page, users }) => {
    await test.step("Admin creates an In-App Survey", async () => {
      const user = await users.create();
      await user.login();

      await page.waitForURL(/\/environments\/[^/]+\/surveys/);

      await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).isVisible();
      await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).click();

      await page.getByRole("button", { name: "Use this template" }).isVisible();
      await page.getByRole("button", { name: "Use this template" }).click();

      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit/);

      await page.getByRole("button", { name: "Settings", exact: true }).click();

      await expect(page.locator("#howToSendCardTrigger")).toBeVisible();
      await page.locator("#howToSendCardTrigger").click();

      await expect(page.locator("#howToSendCardOption-app")).toBeVisible();
      await page.locator("#howToSendCardOption-app").click();

      await page.locator("#whenToSendCardTrigger").click();

      await page.getByRole("button", { name: "Add action" }).click();
      await page.getByText("New SessionGets fired when a").click();

      await page.locator("#recontactOptionsCardTrigger").click();

      await page.locator("label").filter({ hasText: "Keep showing while conditions" }).click();
      await page.locator("#recontactDays").check();

      await page.getByRole("button", { name: "Publish" }).click();

      environmentId =
        /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
        (() => {
          throw new Error("Unable to parse environmentId from URL");
        })();

      await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary/);
    });

    await test.step("JS display survey on page and submit response", async () => {
      let currentDir = process.cwd();
      let htmlFilePath = currentDir + "/packages/js/index.html";

      let htmlFile = replaceEnvironmentIdInHtml(htmlFilePath, environmentId);
      await page.goto(htmlFile);

      // Formbricks In App Sync has happened
      const syncApi = await page.waitForResponse(
        (response) => {
          return response.url().includes("/app/sync");
        },
        {
          timeout: 120000,
        }
      );

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

      // loading spinner -> wait for it to disappear
      await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });
      await page.waitForLoadState("networkidle");
    });

    await test.step("Admin validates Displays & Response", async () => {
      await page.goto("/");
      await page.waitForURL(/\/environments\/[^/]+\/surveys/);

      await page.getByRole("link", { name: "product Market Fit (Superhuman)" }).click();
      (await page.waitForSelector("text=Responses")).isVisible();

      await page.waitForLoadState("networkidle");

      const impressionsCount = await page.getByRole("button", { name: "Impressions" }).innerText();
      expect(impressionsCount).toEqual("Impressions\n\n1");

      await expect(page.getByRole("link", { name: "Responses (1)" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Completed 100%" })).toBeVisible();

      await expect(page.getByText("1 Responses", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("CTR100%")).toBeVisible();
      await expect(page.getByText("Somewhat disappointed100%")).toBeVisible();
      await expect(page.getByText("Founder100%")).toBeVisible();
      await expect(page.getByText("People who believe that PMF").first()).toBeVisible();
      await expect(page.getByText("Much higher response rates!").first()).toBeVisible();
      await expect(page.getByText("Make this end to end test").first()).toBeVisible();
    });
  });
});
