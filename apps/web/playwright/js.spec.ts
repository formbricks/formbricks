import { expect } from "@playwright/test";
import http from "http";
import { test } from "./lib/fixtures";

const HTML_TEMPLATE = `<head>
  <script type="text/javascript">
    !(function () {
      var t = document.createElement("script");
      (t.type = "text/javascript"), (t.async = !0), (t.src = "http://localhost:3000/js/formbricks.umd.cjs");
      t.onload = function () {
        formbricks.init({
            environmentId: "ENVIRONMENT_ID",
            userId: "RANDOM_USER_ID",
            apiHost: "http://localhost:3000",
        });
      };
      var e = document.getElementsByTagName("script")[0];
      e.parentNode.insertBefore(t, e);
    })();
  </script>
</head>

<body style="background-color: #fff">
  <p>This is my sample page using the Formbricks JS javascript widget</p>
</body>
`;

test.describe("JS Package Test", async () => {
  let server: http.Server;
  let environmentId: string;

  test.setTimeout(3 * 60 * 1000);
  test.beforeAll(async () => {
    // Create a simple HTTP server
    server = http.createServer((_, res) => {
      const htmlContent = HTML_TEMPLATE.replace("ENVIRONMENT_ID", environmentId || "");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlContent);
    });

    await new Promise<void>((resolve) => {
      server.listen(3004, () => resolve());
    });
  });

  test.afterAll(async () => {
    // Cleanup: close the server
    await new Promise((resolve) => server.close(resolve));
  });

  test("Create, display and validate PMF survey", async ({ page, users }) => {
    // Create and login user
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);

    // Extract environmentId early in the test
    environmentId =
      /\/environments\/([^/]+)\/surveys/.exec(page.url())?.[1] ??
      (() => {
        throw new Error("Unable to parse environmentId from URL");
      })();

    // Create survey from template
    await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).isVisible();
    await page.getByRole("heading", { name: "Product Market Fit (Superhuman)" }).click();
    await page.getByRole("button", { name: "Use this template" }).isVisible();
    await page.getByRole("button", { name: "Use this template" }).click();

    // Configure survey settings
    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit/);
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#howToSendCardTrigger")).toBeVisible();
    await page.locator("#howToSendCardTrigger").click();
    await expect(page.locator("#howToSendCardOption-app")).toBeVisible();
    await page.locator("#howToSendCardOption-app").click();

    await page.locator("#whenToSendCardTrigger").click();
    await page.getByRole("button", { name: "Add action" }).click();

    await page.getByRole("button", { name: "Capture new action" }).click();
    await page.getByPlaceholder("E.g. Clicked Download").click();
    await page.getByPlaceholder("E.g. Clicked Download").fill("New Session");
    await page.getByText("Page View").click();
    await page.getByRole("button", { name: "Create action" }).click();

    await page.locator("#recontactOptionsCardTrigger").click();
    await page.locator("label").filter({ hasText: "Keep showing while conditions" }).click();
    await page.locator("#recontactDays").check();

    await page.getByRole("button", { name: "Publish" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/summary/);

    // No need for file operations anymore, just use the server
    await page.goto("http://localhost:3004");

    const syncApi = await page.waitForResponse((response) => response.url().includes("/environment"), {
      timeout: 120000,
    });
    expect(syncApi.status()).toBe(200);

    await expect(page.locator("#formbricks-modal-container")).toHaveCount(1);
    await expect(
      page.locator("#questionCard-0").getByRole("link", { name: "Powered by Formbricks" })
    ).toBeVisible();

    // Fill the survey
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

    await page.getByTestId("loading-spinner").waitFor({ state: "hidden" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    // Validate displays and response
    await page.goto("/");
    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await page.getByRole("link", { name: "product Market Fit (Superhuman)" }).click();
    await page.waitForSelector("text=Responses");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

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
