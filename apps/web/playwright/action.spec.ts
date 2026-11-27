import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";

/**
 * The user actions settings page end to end: create one action of each kind the form builds differently
 * (a click on a CSS selector, a page view limited to matching URLs, a code action), rename one, delete
 * another. One journey with `test.step` phases, since each phase starts from the previous one's table.
 *
 * Exit intent and 50% scroll are a bare radio choice with no fields of their own, so they are covered by
 * `app/api/internal/action-classes/route.create.test.ts` rather than here.
 *
 * Asserted at feature level: what the table shows after a reload, and what the database holds.
 */

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

const actionTitle = (page: Page, name: string) => page.getByTitle(name, { exact: true });

const startNewAction = async (page: Page, name: string, description: string) => {
  await page.getByRole("button", { name: "Add Action" }).click();
  await page.getByLabel("What did your user do?").fill(name);
  await page.getByLabel("Description").fill(description);
};

const submitNewAction = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Create action", exact: true }).click();
  await expect(actionTitle(page, name)).toBeVisible({ timeout: 15000 });
};

const openActionSettings = async (page: Page, name: string) => {
  await actionTitle(page, name).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
};

test.describe("User actions settings", () => {
  test("creates click, page view and code actions, renames one and deletes one", async ({ page, users }) => {
    const run = stamp();
    const user = await users.create({ workspaceName: `Actions Workspace ${run}` });
    const { workspaceId } = user;
    if (!workspaceId) throw new Error("Workspace not seeded for the test user");

    const click = { name: `Clicked upgrade ${run}`, selector: ".upgrade-button" };
    const pageView = { name: `Viewed pricing ${run}`, urlContains: "pricing" };
    const code = { name: `Signed up ${run}`, key: `signed-up-${run}` };
    const renamedClick = `Clicked upgrade, renamed ${run}`;

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/workspaces/${workspaceId}/settings/workspace/user-actions`, { waitUntil: "load" });

    await test.step("create a click action on a CSS selector", async () => {
      await startNewAction(page, click.name, "Click on the upgrade button");
      await page.locator("#CssSelector").click();
      await page.locator("[name='noCodeConfig.elementSelector.cssSelector']").fill(click.selector);
      await submitNewAction(page, click.name);
    });

    await test.step("create a page view action limited to matching URLs", async () => {
      await startNewAction(page, pageView.name, "Opened the pricing page");
      await page.getByText("Page View", { exact: true }).click();
      await page.getByText("Limit to specific pages").click();
      await page.locator("[name='noCodeConfig.urlFilters.0.rule']").selectOption({ label: "Contains" });
      await page.locator("[name='noCodeConfig.urlFilters.0.value']").fill(pageView.urlContains);
      await submitNewAction(page, pageView.name);
    });

    await test.step("create a code action", async () => {
      await startNewAction(page, code.name, "Tracked from the app");
      await page.getByText("Code", { exact: true }).click();
      await page.getByLabel("Key").fill(code.key);
      await submitNewAction(page, code.name);
    });

    await test.step("the three actions are stored with the settings they were given", async () => {
      const stored = await prisma.actionClass.findMany({
        where: { workspaceId, name: { in: [click.name, pageView.name, code.name] } },
        select: { name: true, type: true, key: true, noCodeConfig: true },
      });
      const byName = Object.fromEntries(stored.map((action) => [action.name, action]));

      expect(byName[click.name]).toMatchObject({
        type: "noCode",
        noCodeConfig: { type: "click", elementSelector: { cssSelector: click.selector } },
      });
      expect(byName[pageView.name]).toMatchObject({
        type: "noCode",
        noCodeConfig: { type: "pageView", urlFilters: [{ rule: "contains", value: pageView.urlContains }] },
      });
      expect(byName[code.name]).toMatchObject({ type: "code", key: code.key });
    });

    await test.step("rename the click action: the new name survives a reload", async () => {
      await openActionSettings(page, click.name);
      await page.getByLabel("What did your user do?").fill(renamedClick);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(actionTitle(page, renamedClick)).toBeVisible({ timeout: 15000 });

      await page.reload({ waitUntil: "load" });
      await expect(actionTitle(page, renamedClick)).toBeVisible({ timeout: 15000 });
      await expect(actionTitle(page, click.name)).toHaveCount(0);
    });

    await test.step("delete the page view action: it is gone after a reload", async () => {
      await openActionSettings(page, pageView.name);
      await page.locator("#deleteActionModalTrigger").click();
      await page
        .getByRole("dialog", { name: "Delete Action" })
        .getByRole("button", { name: "Delete", exact: true })
        .click();
      await expect(actionTitle(page, pageView.name)).toHaveCount(0, { timeout: 15000 });

      await page.reload({ waitUntil: "load" });
      await expect(actionTitle(page, renamedClick)).toBeVisible({ timeout: 15000 });
      await expect(actionTitle(page, pageView.name)).toHaveCount(0);
      await expect(actionTitle(page, code.name)).toBeVisible();
      await expect
        .poll(() => prisma.actionClass.count({ where: { workspaceId, name: pageView.name } }))
        .toBe(0);
    });
  });
});
