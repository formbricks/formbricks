import { test, expect } from "@playwright/test";

const email = "test@gmail.com";
const password = "Test@123";

async function createUser(page) {
  await page.goto("/auth/signup");
  await page.getByText("Continue with Email").click();
  await page.fill('input[name="name"]', "test");
  await page.press('input[name="name"]', "Tab");
  await page.fill('input[name="email"]', email);
  await page.press('input[name="email"]', "Tab");
  await page.fill('input[name="password"]', password);
  await page.press('input[name="password"]', "Enter");
}

async function loginUser(page) {
  await page.goto("/auth/login");
  await page.getByText("Login with Email").click();
  await page.fill('input[name="email"]', email);
  await page.press('input[name="email"]', "Tab");
  await page.fill('input[name="password"]', password);
  await page.press('input[name="password"]', "Enter");
}

async function completeOnboarding(page) {
  await page.getByText("Begin (1 min)").click();
  await page.getByLabel("Engineer").check();
  await page.getByText("Next").click();
  await page.getByLabel("Improve user retention").check();
  await page.getByText("Next").click();
  await page.getByLabel("Your product name").fill("test");
  await page.getByText("Done").click();
  await expect(page).toHaveTitle(/Your Surveys | Formbricks/);
}

test("create account, login, and complete onboarding", async ({ page }) => {
  await createUser(page);
  await loginUser(page);
  await completeOnboarding(page);
});
