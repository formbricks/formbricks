import { Page } from "playwright";
import { expect } from "@playwright/test";

export const signUpAndLogin = async (
  page: Page,
  name: string,
  email: string,
  password: string
): Promise<void> => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByPlaceholder("Full Name").fill(name);
  await page.getByPlaceholder("Full Name").press("Tab");
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("work@email.com").press("Tab");
  await page.getByPlaceholder("*******").fill(password);
  await page.press('input[name="password"]', "Enter");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Login with Email" }).click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};

export const login = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Login with Email" }).click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};

export const skipOnboarding = async (page: Page): Promise<void> => {
  await page.waitForURL("/onboarding");
  await expect(page).toHaveURL("/onboarding");
  await page.getByRole("button", { name: "I'll do it later" }).click();
  await page.getByRole("button", { name: "I'll do it later" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await expect(page).toHaveURL(/\/environments\/[^/]+\/surveys/);
  await expect(page.getByText("My Product")).toBeVisible();
};
