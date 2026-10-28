import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { mockUsers } from "./utils/mock";

const { name, email, password } = mockUsers.signup[0];
const mixedCaseEmail = email.replace("signup", "SignUp");
const normalizedEmailPattern = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test.describe("Email Signup Flow Test", async () => {
  test.describe.configure({ mode: "serial" });

  // The email and password fields are always on the page; there is no "continue with email" step.
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByTestId("signup-email")).toBeVisible();
  });

  const submitButton = (page: Page) => page.getByRole("button", { name: "Create account" });

  test("Valid User", async ({ page }) => {
    await page.getByTestId("signup-name").fill(name);
    await page.getByTestId("signup-email").fill(mixedCaseEmail);
    await page.getByTestId("signup-password").fill(password);
    await page.getByTestId("signup-password").press("Enter");
    await page.waitForURL(/\/auth\/signup-without-verification-success.*/);
    await expect(page).toHaveURL(/\/auth\/signup-without-verification-success.*/);
    await expect(page).not.toHaveURL(/token=undefined/);
    await expect(page.getByText(normalizedEmailPattern)).toBeVisible();
  });

  test("No Name", async ({ page }) => {
    await page.getByTestId("signup-name").fill("");
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill(password);
    await expect(submitButton(page)).toBeDisabled();
  });

  test("Invalid Email", async ({ page }) => {
    await page.getByTestId("signup-name").fill(name);
    await page.getByTestId("signup-email").fill("invalid");
    await page.getByTestId("signup-password").fill(password);
    await expect(submitButton(page)).toBeDisabled();
  });

  test("Invalid Password", async ({ page }) => {
    await page.getByTestId("signup-name").fill(name);
    await page.getByTestId("signup-email").fill(email);
    await page.getByTestId("signup-password").fill("invalid");
    await expect(submitButton(page)).toBeDisabled();
  });
});

// ENG-2428. The signed-out screens used to be covered by NoMobileOverlay below 640px, so
// nothing here could run at a phone width. These two guard what removing it bought: the
// layout reflows to 320px (WCAG 1.4.10), and the form is operable and free of AA violations.
const MOBILE = { width: 375, height: 812 };

// The same WCAG AA set survey-accessibility.spec.ts gates on.
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("Signed-out screens on a phone", () => {
  test("reflow to 320px without horizontal scrolling", async ({ page }) => {
    // Two widths, each with a reason: 320 is the WCAG 1.4.10 floor, and 430 is the repo's
    // own `xs` breakpoint — the only place the auth surface changes behaviour between them.
    for (const width of [320, 430]) {
      await page.setViewportSize({ width, height: 812 });

      for (const path of ["/auth/login", "/auth/forgot-password", "/auth/signup"]) {
        await page.goto(path);
        await page.waitForLoadState("load");
        expect(await horizontalOverflow(page), `${path} at ${width}px`).toBe(0);
      }

      // The login card is at its fullest with both fields and the SSO options on screen.
      await page.goto("/auth/login");
      await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
      expect(await horizontalOverflow(page), `login form at ${width}px`).toBe(0);
    }
  });

  test("the signup form is labelled and operable at 375px", async ({ page }) => {
    // A distinct address: the serial block above already registers mockUsers.signup[0].
    const mobileEmail = `signup-mobile-${Date.now()}@formbricks.com`;

    await page.setViewportSize(MOBILE);
    await page.goto("/auth/signup");

    await page.getByTestId("signup-name").fill(name);
    await page.getByTestId("signup-email").fill(mobileEmail);
    await page.getByTestId("signup-password").fill(password);

    // axe's `label` rule (wcag2a) is what holds the labels to account — it fails on any
    // input without an accessible name, without pinning the copy to a string in this spec.

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ");
    expect(results.violations, `axe AA violations: ${summary}`).toEqual([]);

    await page.getByTestId("signup-submit").click();
    await page.waitForURL(/\/auth\/signup-without-verification-success.*/);
  });
});
