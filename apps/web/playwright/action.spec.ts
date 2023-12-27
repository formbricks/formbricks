import { actions, users } from "@/playwright/utils/mock";
import { Page, expect, test } from "@playwright/test";

import { signUpAndLogin, skipOnboarding } from "./utils/helper";

const createNoCodeActionByCSSSelector = async (
  page: Page,
  username: string,
  email: string,
  password: string,
  actionName: string,
  description: string,
  selector: string
) => {
  await signUpAndLogin(page, username, email, password);
  await skipOnboarding(page);

  await page.getByRole("link", { name: "Actions & Attributes" }).click();

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(actionName);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  // User toggles the CSS Selector action type

  await expect(page.locator("#CssSelector")).toBeVisible();
  await page.locator("#CssSelector").click();

  // User fills the CSS Selector to track
  await expect(page.locator("[name='noCodeConfig.cssSelector.value']")).toBeVisible();
  await page.locator("[name='noCodeConfig.cssSelector.value']").fill(selector);
  await page.getByRole("button", { name: "Track Action", exact: true }).click();
};

const createNoCodeActionByPageURL = async (
  page: Page,
  username: string,
  email: string,
  password: string,
  actionName: string,
  description: string,
  matcher: {
    label: string;
    value: string;
  },
  testURL: string
) => {
  await signUpAndLogin(page, username, email, password);
  await skipOnboarding(page);

  await page.getByRole("link", { name: "Actions & Attributes" }).click();

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(actionName);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  // User toggles the Page URL action type

  await expect(page.locator("#PageURL")).toBeVisible();
  await page.locator("#PageURL").click();

  // User opens the dropdown and selects the URL match type
  await expect(page.locator("[name='noCodeConfig.[pageUrl].rule']")).toBeVisible();
  await page.locator("[name='noCodeConfig.[pageUrl].rule']").selectOption({ label: matcher.label });

  // User fills the Page URL to track
  await page.locator("[name='noCodeConfig.[pageUrl].value']").fill(matcher.value);

  // User fills the Test URL to track
  await page.locator("[name='noCodeConfig.[pageUrl].testUrl']").fill(testURL);

  // User clicks the Test Match button
  await page.getByRole("button", { name: "Test Match", exact: true }).click();

  // User clicks the Track Action button
  await page.getByRole("button", { name: "Track Action", exact: true }).click();
};

const createNoCodeActionByInnerText = async (
  page: Page,
  username: string,
  email: string,
  password: string,
  actionName: string,
  description: string,
  innerText: string
) => {
  await signUpAndLogin(page, username, email, password);
  await skipOnboarding(page);

  await page.getByRole("link", { name: "Actions & Attributes" }).click();

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(actionName);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  // User toggles the Inner Text action type

  await expect(page.locator("#InnerText")).toBeVisible();
  await page.locator("#InnerText").click();

  // User fills the Inner Text to track
  await expect(page.locator("[name='noCodeConfig.innerHtml.value']")).toBeVisible();
  await page.locator("[name='noCodeConfig.innerHtml.value']").fill(innerText);
  await page.getByRole("button", { name: "Track Action", exact: true }).click();
};

test.describe("Create No Code Action and Edit", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[0];

  test("Create No Code Action by CSS Selector and Edit", async ({ page }) => {
    await createNoCodeActionByCSSSelector(
      page,
      username,
      email,
      password,
      actions.create.noCode.cssSelector.name,
      actions.create.noCode.cssSelector.description,
      actions.create.noCode.cssSelector.selector
    );
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    await page.waitForResponse(async (response) => {
      return response.url().includes("/actions") && response.status() === 200;
    });

    const actionButton = page.locator("#actionClassesWrapper").locator("button").last();
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.cssSelector.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.cssSelector.description);

    await expect(page.locator("[name='noCodeConfig.cssSelector.value']")).toBeVisible();
    await page
      .locator("[name='noCodeConfig.cssSelector.value']")
      .fill(actions.edit.noCode.cssSelector.selector);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });

  test("Create No Code Action by Page URL and Edit", async ({ page }) => {
    await createNoCodeActionByPageURL(
      page,
      username,
      email,
      password,
      actions.create.noCode.pageURL.name,
      actions.create.noCode.pageURL.description,
      actions.create.noCode.pageURL.matcher,
      actions.create.noCode.pageURL.testURL
    );
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    await page.waitForResponse(async (response) => {
      return response.url().includes("/actions") && response.status() === 200;
    });

    const actionButton = page.locator("#actionClassesWrapper").locator("button").last();
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.pageURL.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.pageURL.description);

    await expect(page.locator("[name='noCodeConfig.[pageUrl].rule']")).toBeVisible();
    await page
      .locator("[name='noCodeConfig.[pageUrl].rule']")
      .selectOption({ label: actions.edit.noCode.pageURL.matcher.label });

    await page
      .locator("[name='noCodeConfig.[pageUrl].value']")
      .fill(actions.edit.noCode.pageURL.matcher.value);

    await page.locator("[name='noCodeConfig.[pageUrl].testUrl']").fill(actions.edit.noCode.pageURL.testURL);
    await page.getByRole("button", { name: "Test Match", exact: true }).click();
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });

  test("Create No Code Action by Inner Text and Edit", async ({ page }) => {
    await createNoCodeActionByInnerText(
      page,
      username,
      email,
      password,
      actions.create.noCode.innerText.name,
      actions.create.noCode.innerText.description,
      actions.create.noCode.innerText.innerText
    );
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    await page.waitForResponse(async (response) => {
      return response.url().includes("/actions") && response.status() === 200;
    });

    const actionButton = page.locator("#actionClassesWrapper").locator("button").last();
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.innerText.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.innerText.description);

    await expect(page.locator("[name='noCodeConfig.innerHtml.value']")).toBeVisible();
    await page.locator("[name='noCodeConfig.innerHtml.value']").fill(actions.edit.noCode.innerText.innerText);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create Code Action and Edit", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[1];

  test("Create Code Action", async ({ page }) => {
    await signUpAndLogin(page, username, email, password);
    await skipOnboarding(page);

    await page.getByRole("link", { name: "Actions & Attributes" }).click();

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    // User selects the Code tab
    await page.getByRole("button", { name: "Code", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.create.noCode.innerText.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.create.noCode.innerText.description);

    await page.getByRole("button", { name: "Track Action", exact: true }).click();

    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    await page.waitForResponse(async (response) => {
      return response.url().includes("/actions") && response.status() === 200;
    });

    const actionButton = page.locator("#actionClassesWrapper").locator("button").last();
    await expect(actionButton).toBeVisible();

    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#actionNameSettingsInput")).toBeVisible();
    await page.locator("#actionNameSettingsInput").fill(actions.edit.code.name);

    await expect(page.locator("#actionDescriptionSettingsInput")).toBeVisible();
    await page.locator("#codeActionDescriptionInput").fill(actions.edit.code.description);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Delete Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[2];

  test("Delete Action", async ({ page }) => {
    await createNoCodeActionByCSSSelector(
      page,
      username,
      email,
      password,
      actions.delete.noCode.name,
      actions.delete.noCode.description,
      actions.delete.noCode.selector
    );

    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    await page.waitForResponse(async (response) => {
      return response.url().includes("/actions") && response.status() === 200;
    });

    const actionButton = page.locator("#actionClassesWrapper").locator("button").last();
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#deleteActionModalTrigger")).toBeVisible();
    await page.locator("#deleteActionModalTrigger").click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
  });
});
