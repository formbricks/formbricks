import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { dashboardUrl, setupDashboard, userIdFilter } from "./utils/dashboards";

// ENG-6896 user stories, "Dashboard filters": an Owner or Manager pins filters to the top of a dashboard
// in edit mode; nothing is stored until the dashboard is saved, and a dashboard holds at most 10.

const filterBar = (page: Page) => page.getByTestId("dashboard-filter-bar");

const pickFieldOption = async (page: Page, field: string) => {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Field" }).click();
  await page.getByPlaceholder("Search").last().fill(field);
  await page.getByRole("option", { name: field, exact: true }).click();
};

test.describe("Dashboard filters", () => {
  test("an owner pins a filter in edit mode and it is there after saving and reloading @smoke", async ({
    page,
    users,
  }) => {
    const setup = await setupDashboard(users);
    await setup.owner.login();
    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));
    await expect(page.getByText(setup.chartName)).toBeVisible();

    // The edit shortcut enters edit mode.
    await page.locator("body").press("e");
    await filterBar(page).getByRole("button", { name: "Add filter" }).click();

    await pickFieldOption(page, "User Identifier");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("combobox", { name: "Operator" })).toContainText("equals");
    // The label follows the field until edited.
    const label = dialog.getByLabel("Label");
    await expect(label).toHaveValue("User Identifier");
    await label.fill("Sales rep");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(filterBar(page).getByRole("button", { name: "Edit Sales rep" })).toBeVisible();
    // Still a draft: nothing stored before the dashboard is saved.
    expect((await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } })).filters).toEqual(
      []
    );

    await page.getByRole("toolbar", { name: "Action buttons" }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Dashboard saved successfully")).toBeVisible();

    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.filters).toEqual([
      expect.objectContaining({ field: "FeedbackRecords.userId", operator: "equals", label: "Sales rep" }),
    ]);

    await page.reload();
    await expect(filterBar(page).getByRole("button", { name: "Edit Sales rep" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add filter" })).toHaveCount(0);
  });

  test("cancelling edit mode drops a filter that was not saved", async ({ page, users }) => {
    const setup = await setupDashboard(users, { filters: [userIdFilter("Kept")] });
    await setup.owner.login();
    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));

    await page.getByRole("toolbar", { name: "Action buttons" }).getByRole("button", { name: "Edit" }).click();
    await filterBar(page).getByRole("button", { name: "Remove Kept" }).click();
    await expect(filterBar(page).getByRole("button", { name: "Edit Kept" })).toHaveCount(0);

    await page
      .getByRole("toolbar", { name: "Action buttons" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect(filterBar(page).getByRole("button", { name: "Edit Kept" })).toBeVisible();
    const stored = await prisma.dashboard.findUniqueOrThrow({ where: { id: setup.dashboardId } });
    expect(stored.filters).toHaveLength(1);
  });

  test("a dashboard holding 10 filters offers no eleventh", async ({ page, users }) => {
    const filters = Array.from({ length: 10 }, (_, i) => userIdFilter(`Filter ${i + 1}`));
    const setup = await setupDashboard(users, { filters });
    await setup.owner.login();
    await page.goto(dashboardUrl(setup.workspaceId, setup.dashboardId));

    for (const filter of filters) {
      await expect(
        filterBar(page).getByRole("button", { name: `Edit ${filter.label}`, exact: true })
      ).toBeVisible();
    }
    await page.locator("body").press("e");
    await expect(filterBar(page).getByRole("button", { name: "Add filter" })).toBeDisabled();

    // The API holds the same line.
    const response = await page.request.patch(`/api/v3/dashboards/${setup.dashboardId}`, {
      data: { filters: [...filters, userIdFilter("Filter 11")] },
    });
    expect(response.status(), await response.text()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
