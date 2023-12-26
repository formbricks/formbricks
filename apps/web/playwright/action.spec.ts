import { actions, users } from "@/playwright/utils/mock";
import { expect, test } from "@playwright/test";

import { login } from "./utils/helper";

test.describe("Create No Code Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password } = users.survey[0];

  test("Create No Code Action by CSS Selector", async ({ page }) => {
    // await signUpAndLogin(page, name, email, password);
    await login(page, email, password);
    // await skipOnboarding(page);

    await page.getByRole("link", { name: "Actions & Attributes" }).click();

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    // User fills the action name and description
    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.create.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.create.description);

    // User toggles the CSS Selector action type

    await expect(page.locator("#CssSelector")).toBeVisible();
    await page.locator("#CssSelector").click();

    // User fills the CSS Selector to track
    await expect(page.locator("[name='noCodeConfig.cssSelector.value']")).toBeVisible();
    await page.locator("[name='noCodeConfig.cssSelector.value']").fill(actions.selectBy.cssSelector);
    await page.getByRole("button", { name: "Track Action", exact: true }).click();
  });

  test("Create No Code Action by selecting Page URL", async ({ page }) => {
    // await signUpAndLogin(page, name, email, password);
    await login(page, email, password);
    // await skipOnboarding(page);

    await page.getByRole("link", { name: "Actions & Attributes" }).click();

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    // User fills the action name and description
    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.create.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.create.description);

    // User toggles the Page URL action type

    await expect(page.locator("#PageURL")).toBeVisible();
    await page.locator("#PageURL").click();

    // User opens the dropdown and selects the URL match type
    await expect(page.locator("[name='noCodeConfig.[pageUrl].rule']")).toBeVisible();
    await page
      .locator("[name='noCodeConfig.[pageUrl].rule']")
      .selectOption({ label: actions.selectBy.pageURL.matcher.label });

    // User fills the Page URL to track
    await page.locator("[name='noCodeConfig.[pageUrl].value']").fill(actions.selectBy.pageURL.matcher.value);

    // User fills the Test URL to track
    await page.locator("[name='noCodeConfig.[pageUrl].testUrl']").fill(actions.selectBy.pageURL.testURL);

    // User clicks the Test Match button
    await page.getByRole("button", { name: "Test Match", exact: true }).click();

    // User clicks the Track Action button
    await page.getByRole("button", { name: "Track Action", exact: true }).click();
  });

  test("Create No Code Action by Inner Text", async ({ page }) => {
    // await signUpAndLogin(page, name, email, password);
    await login(page, email, password);
    // await skipOnboarding(page);

    await page.getByRole("link", { name: "Actions & Attributes" }).click();

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    // User fills the action name and description
    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.create.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.create.description);

    // User toggles the Inner Text action type

    await expect(page.locator("#InnerText")).toBeVisible();
    await page.locator("#InnerText").click();

    // User fills the Inner Text to track
    await expect(page.locator("[name='noCodeConfig.innerHtml.value']")).toBeVisible();
    await page.locator("[name='noCodeConfig.innerHtml.value']").fill(actions.selectBy.innerText);
    await page.getByRole("button", { name: "Track Action", exact: true }).click();
  });
});

test.describe("Create Code Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password } = users.survey[0];

  test("Create Code Action", async ({ page }) => {
    // await signUpAndLogin(page, name, email, password);
    await login(page, email, password);
    // await skipOnboarding(page);

    await page.getByRole("link", { name: "Actions & Attributes" }).click();

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    // User selects the Code tab
    await page.getByRole("button", { name: "Code", exact: true }).click();

    await expect(page.locator("#codeActionNameInput")).toBeVisible();
    await page.locator("#codeActionNameInput").fill(actions.create.name);

    await expect(page.locator("#codeActionDescriptionInput")).toBeVisible();
    await page.locator("#codeActionDescriptionInput").fill(actions.create.description);
    await page.getByRole("button", { name: "Track Action", exact: true }).click();
  });
});
