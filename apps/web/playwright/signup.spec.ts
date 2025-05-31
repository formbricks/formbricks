import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { mockUsers } from "./utils/mock";

const { name, email, password } = mockUsers.signup[0];

test.describe("Email Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();
  });

  test("Valid User", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
    await page.waitForURL("/auth/signup-without-verification-success");
    await expect(page).toHaveURL("/auth/signup-without-verification-success");
  });

  test("No Name", async ({ page }) => {
    await page.fill('input[name="name"]', "");
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });

  test("Invalid Email", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', "invalid");
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });

  test("Invalid Password", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', "invalid");
    await page.press('input[name="password"]', "Enter");
    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });
});
