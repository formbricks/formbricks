import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";

test.describe("Onboarding Flow Test", async () => {
  test("start from scratch", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/survey/);
    await page.getByRole("button", { name: "Start from scratch" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit(\?.*)mode=cx/);
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });

  test("use template", async ({ page, users }) => {
    const user = await users.create({ skipSurveySeed: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/survey/);
    await page.getByRole("button", { name: "Use a template" }).click();

    await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/templates/);
    await page.getByRole("button", { name: "NPS" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit(\?.*)mode=cx/);
    await page.getByRole("button", { name: "Save & Close" }).click();

    await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
  });
});
