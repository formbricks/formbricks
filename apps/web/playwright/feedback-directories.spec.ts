import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { test } from "./lib/fixtures";
import { isBehindUpgradePrompt } from "./utils/helper";

/**
 * Feedback datasets (feedback directories) on the organization settings page: create one, rename it,
 * archive it and bring it back. Asserted on what the page shows and what the database holds, so it holds
 * before and after the page moved from server actions onto `/api/internal/feedback-datasets` (ENG-3984).
 *
 * Datasets are an Enterprise feature: the spec skips, saying why, where the E2E licence lacks them.
 */
test.describe("Feedback datasets", () => {
  test("creates, renames, archives and unarchives a dataset", async ({ page, users }) => {
    const run = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const name = `Dataset ${run}`;
    const renamed = `Renamed dataset ${run}`;
    const user = await users.create();
    const { organizationId } = user;
    if (!organizationId) throw new Error("Organization not seeded for the test user");

    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);
    await page.goto(`/organizations/${organizationId}/settings/feedback-directories`, {
      waitUntil: "domcontentloaded",
    });
    test.skip(
      await isBehindUpgradePrompt(page, page.getByRole("button", { name: "Create dataset" })),
      "The E2E licence does not include feedback datasets."
    );

    const row = (rowName: string) => page.getByRole("row").filter({ hasText: rowName });
    const stored = () =>
      prisma.feedbackDirectory.findFirst({
        where: { organizationId, name: { in: [name, renamed] } },
        select: { name: true, isArchived: true },
      });

    await test.step("create a dataset", async () => {
      await page.getByRole("button", { name: "Create dataset" }).click();
      await page.getByPlaceholder("Customer feedback, US only").fill(name);
      await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();

      await expect(page.getByText("Dataset created successfully")).toBeVisible();
      await expect(row(name)).toBeVisible();
      expect(await stored()).toEqual({ name, isArchived: false });
    });

    await test.step("rename it from its settings", async () => {
      await row(name).getByRole("button", { name: "Manage" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByPlaceholder("Customer feedback, US only")).toHaveValue(name);
      await dialog.getByPlaceholder("Customer feedback, US only").fill(renamed);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();

      await expect(page.getByText("Dataset updated successfully")).toBeVisible();
      await expect(row(renamed)).toBeVisible();
      await expect.poll(async () => (await stored())?.name).toBe(renamed);
    });

    await test.step("archive it", async () => {
      await row(renamed).getByRole("button", { name: "Manage" }).click();
      await page.getByRole("button", { name: "Archive dataset" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Archive", exact: true }).click();

      await expect(page.getByText("Dataset archived successfully")).toBeVisible();
      await expect.poll(async () => (await stored())?.isArchived).toBe(true);
      await expect(row(renamed)).toHaveCount(0);
    });

    await test.step("bring it back", async () => {
      await page.getByRole("switch").click();
      await row(renamed).getByRole("button", { name: "Unarchive" }).click();

      await expect(page.getByText("Dataset unarchived successfully")).toBeVisible();
      await expect.poll(async () => (await stored())?.isArchived).toBe(false);
    });
  });
});
