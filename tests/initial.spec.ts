import { test, expect } from "@playwright/test";

const email = "testp@gmail.com";
const password = "Test@123";

async function createUser(page) {
  await page.goto("http://localhost:3000/auth/signup");
  await page.getByText("Continue with Email").click();
  await page.fill('input[name="name"]', "test");
  await page.press('input[name="name"]', "Tab");
  await page.fill('input[name="email"]', email);
  await page.press('input[name="email"]', "Tab");
  await page.fill('input[name="password"]', password);
  await page.press('input[name="password"]', "Enter");
}

class LoginPage {
  async login(page, email, password) {
    await page.getByText("Login").click();
    await page.getByText("Login with Email").click();
    await page.fill('input[name="email"]', email);
    await page.press('input[name="email"]', "Tab");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
  }
}

test("create account, login, and complete onboarding", async ({ page }) => {
  const loginPage = new LoginPage();
  await createUser(page);
  await loginPage.login(page, email, password);
  await completeOnboarding(page);
});
  await expect(page).toHaveTitle(/Your Surveys | Formbricks/);
}

test("create account, login, and complete onboarding", async ({ page }) => {
  await createUser(page);
  await loginUser(page);
  await completeOnboarding(page);
});
