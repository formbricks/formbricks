import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { organizations } from "./utils/mock";

const { productName } = organizations.onboarding[0];

test.describe("Onboarding Flow Test", async () => {
  test("link survey", async ({ page, users }) => {
    const user = await users.create({ withoutProduct: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/products\/new\/channel/);

    await page.getByRole("button", { name: "Anywhere online Link" }).click();
    await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(productName);
    await page.locator("form").filter({ hasText: "Brand colorMatch the main" }).getByRole("button").click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });

  test("website survey", async ({ page, users }) => {
    const user = await users.create({ withoutProduct: true });
    await user.login();

    await page.waitForURL(/\/organizations\/[^/]+\/products\/new\/channel/);

    await page.getByRole("button", { name: "Enrich user profiles App with" }).click();
    await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.getByPlaceholder("e.g. Formbricks").click();
    await page.getByPlaceholder("e.g. Formbricks").fill(productName);
    await page.locator("form").filter({ hasText: "Brand colorMatch the main" }).getByRole("button").click();
    await page.getByRole("button", { name: "I don't know how to do it" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/connect\/invite/);
    await page.getByRole("button", { name: "Not now" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });
});
