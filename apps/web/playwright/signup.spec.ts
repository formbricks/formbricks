import { getUser } from "@/playwright/lib/user";
import { test } from "@playwright/test";

const { name, email, password } = getUser();

test.describe("Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });

  test("Valid User", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', name);
    await page.press('input[name="name"]', "Tab");

    await page.fill('input[name="email"]', email);
    await page.press('input[name="email"]', "Tab");

    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    await page.waitForURL("/auth/signup-without-verification-success");
  });

  test("Email is taken", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', name);
    await page.press('input[name="name"]', "Tab");

    await page.fill('input[name="email"]', email);
    await page.press('input[name="email"]', "Tab");

    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    let alertMessage = "user with this email address already exists";

    await (await page.waitForSelector(`text=${alertMessage}`)).isVisible();
  });

  test("No Name", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', "");
    await page.press('input[name="name"]', "Tab");

    await page.fill('input[name="email"]', email);
    await page.press('input[name="email"]', "Tab");

    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    await page.getByText("Continue with Email").isDisabled();
  });

  test("Invalid Email", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', name);
    await page.press('input[name="name"]', "Tab");

    await page.fill('input[name="email"]', "invalid");
    await page.press('input[name="email"]', "Tab");

    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");

    await page.getByText("Continue with Email").isDisabled();
  });

  test("Invalid Password", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    await page.waitForSelector('input[name="name"]');
    await page.fill('input[name="name"]', name);
    await page.press('input[name="name"]', "Tab");

    await page.fill('input[name="email"]', email);
    await page.press('input[name="email"]', "Tab");

    await page.fill('input[name="password"]', "invalid");
    await page.press('input[name="password"]', "Enter");

    await page.getByText("Continue with Email").isDisabled();
  });
});
