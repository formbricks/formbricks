import { actions } from "@/playwright/utils/mock";
import { Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";

const createNoCodeClickAction = async ({
  page,
  name,
  description,
  selector,
}: {
  page: Page;
  name: string;
  description: string;
  selector: string;
}) => {
  await page.goto("/");
  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(name);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  // User toggles the CSS Selector action type

  await expect(page.locator("#CssSelector")).toBeVisible();
  await page.locator("#CssSelector").click();

  // User fills the CSS Selector to track
  await expect(page.locator("[name='noCodeConfig.elementSelector.cssSelector']")).toBeVisible();
  await page.locator("[name='noCodeConfig.elementSelector.cssSelector']").fill(selector);
  await page.getByRole("button", { name: "Create action", exact: true }).click();

  const successToast = await page.waitForSelector(".formbricks__toast__success");
  expect(successToast).toBeTruthy();

  const actionButton = page.getByTitle(name);
  await expect(actionButton).toBeVisible();
};

const createNoCodePageViewAction = async ({
  page,
  name,
  description,
  matcher,
  noCodeType,
}: {
  page: Page;
  name: string;
  description: string;
  matcher: {
    label: string;
    value: string;
  };
  noCodeType: string;
}) => {
  await page.goto("/");
  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(name);

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

  // User clicks the Create Action button
  await page.getByRole("button", { name: "Create action", exact: true }).click();

  const successToast = await page.waitForSelector(".formbricks__toast__success");
  expect(successToast).toBeTruthy();

  const actionButton = page.getByTitle(name);
  await expect(actionButton).toBeVisible();
};

const createNoCodeAction = async ({
  name,
  description,
  noCodeType,
  page,
}: {
  page: Page;
  name: string;
  description: string;
  noCodeType: string;
}) => {
  await page.goto("/");
  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  // User fills the action name and description
  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(name);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  await expect(page.getByText(noCodeType)).toBeVisible();
  await page.getByText(noCodeType).click();

  // User clicks the Create Action button
  await page.getByRole("button", { name: "Create action", exact: true }).click();

  const successToast = await page.waitForSelector(".formbricks__toast__success");
  expect(successToast).toBeTruthy();

  const actionButton = page.getByTitle(name);
  await expect(actionButton).toBeVisible();
};

const createCodeAction = async ({
  description,
  key,
  name,
  page,
}: {
  page: Page;
  name: string;
  description: string;
  key: string;
}) => {
  await page.getByRole("link", { name: "Actions" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/actions/);

  // Add Action button
  await page.getByRole("button", { name: "Add Action" }).click();

  await expect(page.getByLabel("What did your user do?")).toBeVisible();
  await page.getByLabel("What did your user do?").fill(name);

  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);

  // User selects the Code tab
  await page.getByText("Code", { exact: true }).click();

  await expect(page.getByLabel("Key")).toBeVisible();
  await page.getByLabel("Key").fill(key);

  await page.getByRole("button", { name: "Create action", exact: true }).click();

  const successToast = await page.waitForSelector(".formbricks__toast__success");
  expect(successToast).toBeTruthy();

  const actionButton = page.getByTitle(name);
  await expect(actionButton).toBeVisible();
};

const getActionButtonLocator = (page: Page, actionName: string) => {
  return page.getByTitle(actionName);
};

test.describe("Create and Edit No Code Click Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Edit No Code Click Action by CSS Selector", async ({ page }) => {
    await test.step("Create No Code Click Action", async () => {
      await createNoCodeClickAction({
        page,
        name: actions.create.noCode.click.name,
        description: actions.create.noCode.click.description,
        selector: actions.create.noCode.click.selector,
      });
    });

    await test.step("Edit No Code Click Action", async () => {
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
});

test.describe("Create and Edit No Code Page view Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Edit No Code Page view Action", async ({ page }) => {
    await test.step("Create No Code Page view Action", async () => {
      await createNoCodePageViewAction({
        page,
        name: actions.create.noCode.pageView.name,
        description: actions.create.noCode.pageView.description,
        matcher: actions.create.noCode.pageView.matcher,
        noCodeType: "Page View",
      });
    });

    await test.step("Edit No Code Page view Action", async () => {
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

      await page
        .locator("[name='noCodeConfig.urlFilters.testUrl']")
        .fill(actions.edit.noCode.pageView.testURL);
      await page.getByRole("button", { name: "Test Match", exact: true }).click();
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
    });
  });
});

test.describe("Create and Edit No Code Exit Intent Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Edit No Code Exit Intent Action", async ({ page }) => {
    await test.step("Create No Code Exit Intent Action", async () => {
      await createNoCodeAction({
        page,
        name: actions.create.noCode.exitIntent.name,
        description: actions.create.noCode.exitIntent.description,
        noCodeType: "Exit Intent",
      });
    });

    await test.step("Edit No Code Exit Intent Action", async () => {
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
});

test.describe("Create and Edit No Code 50% scroll Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Edit No Code 50% scroll Action", async ({ page }) => {
    await test.step("Create No Code 50% scroll Action", async () => {
      await createNoCodeAction({
        page,
        name: actions.create.noCode["fiftyPercentScroll"].name,
        description: actions.create.noCode["fiftyPercentScroll"].description,
        noCodeType: "50% Scroll",
      });
    });

    await test.step("Edit No Code 50% scroll Action", async () => {
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
});

test.describe("Create and Edit Code Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Edit Code Action", async ({ page }) => {
    await test.step("Create Code Action", async () => {
      await createCodeAction({
        page,
        name: actions.create.code.name,
        description: actions.create.code.description,
        key: actions.create.code.key,
      });
    });

    await test.step("Edit Code Action", async () => {
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
});

test.describe("Create and Delete Action", async () => {
  test.beforeEach(async ({ page, users }) => {
    const user = await users.create();
    await user.login();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  });

  test("Create and Delete Action", async ({ page }) => {
    await test.step("Create action", async () => {
      await createNoCodeClickAction({
        page,
        name: actions.delete.noCode.name,
        description: actions.delete.noCode.description,
        selector: actions.delete.noCode.selector,
      });
    });

    await test.step("Delete Action", async () => {
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
});
