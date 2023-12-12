import { getUser } from "./utils";
import { test, expect } from "@playwright/test";

const { name, email, password } = getUser();

test.describe("Email Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();
  });

  test("Valid User", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
    await page.waitForURL("/auth/signup-without-verification-success");
    await expect(page).toHaveURL("/auth/signup-without-verification-success");
  });

  test("Email is taken", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    let alertMessage = "user with this email address already exists";
    await (await page.waitForSelector(`text=${alertMessage}`)).isVisible();
  });

  test("No Name", async ({ page }) => {
    await page.fill('input[name="name"]', "");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });

  test("Invalid Email", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', "invalid");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });

  test("Invalid Password", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "invalid");
    await page.press('input[name="password"]', "Enter");

    const button = page.getByText("Continue with Email");
    await expect(button).toBeDisabled();
  });
});
