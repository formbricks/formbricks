import { actions, users } from "@/playwright/utils/mock";
import { Page, expect, test } from "@playwright/test";

import { finishOnboarding, login, signUpAndLogin } from "./utils/helper";

const createNoCodeClickAction = async (
  page: Page,
  username: string,
  email: string,
  password: string,
  actionName: string,
  description: string,
  selector: string
) => {
  await signUpAndLogin(page, username, email, password);
  await finishOnboarding(page);

  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

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
  await expect(page.locator("[name='noCodeConfig.elementSelector.cssSelector']")).toBeVisible();
  await page.locator("[name='noCodeConfig.elementSelector.cssSelector']").fill(selector);
  await page.getByRole("button", { name: "Create action", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
};

const createNoCodePageViewAction = async (
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
  testURL: string,
  noCodeType: string
) => {
  await signUpAndLogin(page, username, email, password);
  await finishOnboarding(page);

  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(actionName);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  await expect(page.getByText(noCodeType)).toBeVisible();
  await page.getByText(noCodeType).click();

  // User toggles the url Filters to specific pages
  await page.getByText("Limit to specific pages").click();

  // User opens the dropdown and selects the URL match type
  await expect(page.locator("[name='noCodeConfig.urlFilters.0.rule']")).toBeVisible();
  await page.locator("[name='noCodeConfig.urlFilters.0.rule']").selectOption({ label: matcher.label });

  // User fills the Page URL to track
  await page.locator("[name='noCodeConfig.urlFilters.0.value']").fill(matcher.value);

  // User fills the Test URL to track
  await page.locator("[name='noCodeConfig.urlFilters.testUrl']").fill(testURL);

  // User clicks the Test Match button
  await page.getByRole("button", { name: "Test Match", exact: true }).click();

  // User clicks the Create Action button
  await page.getByRole("button", { name: "Create action", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
};

const createNoCodeAction = async (
  page: Page,
  username: string,
  email: string,
  password: string,
  actionName: string,
  description: string,
  noCodeType: string
) => {
  await signUpAndLogin(page, username, email, password);
  await finishOnboarding(page);

  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(actionName);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  await expect(page.getByText(noCodeType)).toBeVisible();
  await page.getByText(noCodeType).click();

  // User clicks the Create Action button
  await page.getByRole("button", { name: "Create action", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
};

const getActionButtonLocator = (page: Page, actionName: string) => {
  return page.getByTitle(actionName);
};

test.describe("Create and Edit No Code Click Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[0];

  test("Create No Code Click Action by CSS Selector", async ({ page }) => {
    await createNoCodeClickAction(
      page,
      username,
      email,
      password,
      actions.create.noCode.click.name,
      actions.create.noCode.click.description,
      actions.create.noCode.click.selector
    );
  });

  test("Edit No Code Click Action", async ({ page }) => {
    await login(page, email, password);
    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.create.noCode.click.name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.click.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.click.description);

    await expect(page.locator("[name='noCodeConfig.elementSelector.cssSelector']")).toBeVisible();
    await page
      .locator("[name='noCodeConfig.elementSelector.cssSelector']")
      .fill(actions.edit.noCode.click.selector);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create and Edit No Code Page view Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[1];

  test("Create No Code Page view Action", async ({ page }) => {
    await createNoCodePageViewAction(
      page,
      username,
      email,
      password,
      actions.create.noCode.pageView.name,
      actions.create.noCode.pageView.description,
      actions.create.noCode.pageView.matcher,
      actions.create.noCode.pageView.testURL,
      "Page View"
    );
  });

  test("Edit No Code Page view Action", async ({ page }) => {
    await login(page, email, password);

    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.create.noCode.pageView.name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.pageView.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.pageView.description);

    await expect(page.locator("[name='noCodeConfig.urlFilters.0.rule']")).toBeVisible();
    await page
      .locator("[name='noCodeConfig.urlFilters.0.rule']")
      .selectOption({ label: actions.edit.noCode.pageView.matcher.label });

    await page
      .locator("[name='noCodeConfig.urlFilters.0.value']")
      .fill(actions.edit.noCode.pageView.matcher.value);

    await page.locator("[name='noCodeConfig.urlFilters.testUrl']").fill(actions.edit.noCode.pageView.testURL);
    await page.getByRole("button", { name: "Test Match", exact: true }).click();
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create and Edit No Code Exit Intent Action", async () => {
  const { email, password, name: username } = users.action[2];
  test("Create No Code Exit Intent Action", async ({ page }) => {
    await createNoCodeAction(
      page,
      username,
      email,
      password,
      actions.create.noCode.exitIntent.name,
      actions.create.noCode.exitIntent.description,
      "Exit Intent"
    );
  });

  test("Edit No Code Exit Intent Action", async ({ page }) => {
    await login(page, email, password);
    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.create.noCode.exitIntent.name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode.exitIntent.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode.exitIntent.description);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create and Edit No Code 50% scroll Action", async () => {
  const { email, password, name: username } = users.action[3];
  test("Create No Code 50% scroll Action", async ({ page }) => {
    await createNoCodeAction(
      page,
      username,
      email,
      password,
      actions.create.noCode["fiftyPercentScroll"].name,
      actions.create.noCode["fiftyPercentScroll"].description,
      "50% Scroll"
    );
  });

  test("Edit No Code 50% scroll Action", async ({ page }) => {
    await login(page, email, password);
    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.create.noCode["fiftyPercentScroll"].name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.edit.noCode["fiftyPercentScroll"].name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.noCode["fiftyPercentScroll"].description);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create and Edit Code Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[4];

  test("Create Code Action", async ({ page }) => {
    await signUpAndLogin(page, username, email, password);
    await finishOnboarding(page);

    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    // Add Action button
    await page.getByRole("button", { name: "Add Action" }).click();

    await expect(page.getByLabel("What did your user do?")).toBeVisible();
    await page.getByLabel("What did your user do?").fill(actions.create.code.name);

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.create.code.description);

    // User selects the Code tab
    await page.getByText("Code", { exact: true }).click();

    await expect(page.getByLabel("Key")).toBeVisible();
    await page.getByLabel("Key").fill(actions.create.code.key);

    await page.getByRole("button", { name: "Create action", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
  });

  test("Edit Code Action", async ({ page }) => {
    await login(page, email, password);
    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.create.code.name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.getByLabel("Description")).toBeVisible();
    await page.getByLabel("Description").fill(actions.edit.code.description);

    await page.getByRole("button", { name: "Save changes", exact: true }).click();
  });
});

test.describe("Create and Delete Action", async () => {
  test.describe.configure({ mode: "serial" });
  const { email, password, name: username } = users.action[5];

  test("Create Action", async ({ page }) => {
    await createNoCodeClickAction(
      page,
      username,
      email,
      password,
      actions.delete.noCode.name,
      actions.delete.noCode.description,
      actions.delete.noCode.selector
    );
  });

  test("Delete Action", async ({ page }) => {
    await login(page, email, password);

    await page.getByRole("link", { name: "Actions" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/actions/);

    const actionButton = getActionButtonLocator(page, actions.delete.noCode.name);
    await expect(actionButton).toBeVisible();
    await actionButton.click();

    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(page.locator("#deleteActionModalTrigger")).toBeVisible();
    await page.locator("#deleteActionModalTrigger").click();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
  });
});
