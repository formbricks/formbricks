import { expect, test } from "@playwright/test";
import { signUpAndLogin } from "./utils/helper";
import { organizations, users } from "./utils/mock";

const { productName } = organizations.onboarding[0];

test.describe("Onboarding Flow Test", async () => {
  test("link survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[0];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL(/\/organizations\/[^/]+\/products\/new\/channel/);

    await page.getByRole("button", { name: "100% custom branding Anywhere" }).click();
    await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.locator("form").filter({ hasText: "Brand colorChange the brand" }).getByRole("button").click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });

  test("website survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[1];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL(/\/organizations\/[^/]+\/products\/new\/channel/);

    await page.getByRole("button", { name: "Enrich user profiles App with" }).click();
    await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.locator("form").filter({ hasText: "Brand colorChange the brand" }).getByRole("button").click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/connect\/invite/);
    await page.getByRole("button", { name: "Skip" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });

  test("app survey", async ({ page }) => {
    const { name, email, password } = users.onboarding[2];
    await signUpAndLogin(page, name, email, password);
    await page.waitForURL(/\/onboarding\/[^/]+\/channel/);

    await page.getByRole("button", { name: "Built for scale Public" }).click();
    await page.getByRole("button", { name: "B2B and B2C E-Commerce" }).click();
    await page.locator("form").filter({ hasText: "Brand colorChange the brand" }).getByRole("button").click();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.waitForURL(/\/environments\/[^/]+\/connect\/invite/);
    await page.getByRole("button", { name: "Skip" }).click();

    await page.waitForURL(/\/environments\/[^/]+\/surveys/);
    await expect(page.getByText(productName)).toBeVisible();
  });
});
