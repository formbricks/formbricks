import { Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { mockUsers } from "./utils/mock";

const { name, email, password } = mockUsers.signup[0];

const openPublicSignupForm = async (page: Page) => {
  await page.goto("/auth/signup");

  const showEmailSignupButton = page.getByTestId("signup-show-login");
  const isPublicSignupAvailable = await showEmailSignupButton
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  test.skip(
    !isPublicSignupAvailable,
    "Public signup is disabled when multi-org signup is not available in the current environment."
  );

  await showEmailSignupButton.click();
  await expect(page.getByTestId("signup-submit")).toBeVisible();
};

test.describe("Email Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });
  test("Valid User", async ({ page }) => {
    await openPublicSignupForm(page);

    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);

    const submitButton = page.getByTestId("signup-submit");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    await expect(page).toHaveURL(/\/auth\/(signup-without-verification-success|verification-requested).*/);
  });

  test("No Name", async ({ page }) => {
    await openPublicSignupForm(page);

    await page.fill('input[name="name"]', "");
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);

    const button = page.getByTestId("signup-submit");
    await expect(button).toBeDisabled();
  });

  test("Invalid Email", async ({ page }) => {
    await openPublicSignupForm(page);

    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', "invalid");
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);

    const button = page.getByTestId("signup-submit");
    await expect(button).toBeDisabled();
  });

  test("Invalid Password", async ({ page }) => {
    await openPublicSignupForm(page);

    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', email);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', "invalid");

    const button = page.getByTestId("signup-submit");
    await expect(button).toBeDisabled();
  });
});
