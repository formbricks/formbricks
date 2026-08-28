import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { mockUsers } from "./utils/mock";

const { name, email, password } = mockUsers.signup[0];
const mixedCaseEmail = email.replace("signup", "SignUp");
const normalizedEmailPattern = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test.describe("Email Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();
  });

  test("Valid User", async ({ page }) => {
    await page.fill('input[name="name"]', name);
    await page.getByPlaceholder("Full Name").press("Tab");
    await page.fill('input[name="email"]', mixedCaseEmail);
    await page.getByPlaceholder("work@email.com").press("Tab");
    await page.fill('input[name="password"]', password);
    await page.press('input[name="password"]', "Enter");
    await page.waitForURL(/\/auth\/signup-without-verification-success.*/);
    await expect(page).toHaveURL(/\/auth\/signup-without-verification-success.*/);
    await expect(page).not.toHaveURL(/token=undefined/);
    await expect(page.getByText(normalizedEmailPattern)).toBeVisible();
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

// ENG-2428. The signed-out screens used to be covered by NoMobileOverlay below 640px, so
// nothing here could run at a phone width. These two guard the two things that removing it
// bought: the layout reflows to 320px (WCAG 1.4.10) and the form is operable and labelled.
const MOBILE = { width: 375, height: 812 };

// The same WCAG AA set survey-accessibility.spec.ts gates on.
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("Signed-out screens on a phone", () => {
  test("reflow to 320px without horizontal scrolling", async ({ page }) => {
    // 320 is the WCAG 1.4.10 floor; 430 is the repo's own `xs` breakpoint.
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 812 });

      for (const path of ["/auth/login", "/auth/forgot-password", "/auth/signup"]) {
        await page.goto(path);
        await page.waitForLoadState("load");
        expect(await horizontalOverflow(page), `${path} at ${width}px`).toBe(0);
      }

      // The email step is what actually fills the card — six SSO buttons, two fields and a
      // captcha only exist once it is expanded.
      await page.goto("/auth/login");
      await page.getByRole("button", { name: "Log in with Email" }).dispatchEvent("click");
      await expect(page.getByPlaceholder("work@email.com")).toBeVisible();
      expect(await horizontalOverflow(page), `expanded login at ${width}px`).toBe(0);
    }
  });

  test("the signup form is labelled and operable at 375px", async ({ page }) => {
    // A distinct address: the serial block above already registers mockUsers.signup[0].
    const mobileEmail = `signup-mobile-${Date.now()}@formbricks.com`;

    await page.setViewportSize(MOBILE);
    await page.goto("/auth/signup");
    await page.getByText("Continue with Email").click();

    // Every field is reachable by its visible label, not just by placeholder text.
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Email").fill(mobileEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ");
    expect(results.violations, `axe AA violations: ${summary}`).toEqual([]);

    await page.getByTestId("signup-submit").click();
    await page.waitForURL(/\/auth\/signup-without-verification-success.*/);
  });
});
