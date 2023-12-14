import { randomBytes } from "crypto";
import { Page } from "playwright";
import { expect } from "@playwright/test";

export const getUser = () => {
  const name = randomBytes(4).toString("hex");
  const email = `${name}@gmail.com`;
  const password = `Te${name}@123`;
  return { name, email, password };
};

export const getTeam = () => {
  let roles = ["Project Manager", "Engineer", "Founder", "Marketing Specialist"];
  let useCases = [
    "Increase conversion",
    "Improve user retention",
    "Increase user adoption",
    "Sharpen marketing messaging",
    "Support sales",
  ];
  const productName = randomBytes(8).toString("hex");
  const role = roles[Math.floor(Math.random() * roles.length)];
  const useCase = useCases[Math.floor(Math.random() * useCases.length)];
  return { role, useCase, productName };
};

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
  await page.getByPlaceholder("work@email.com").fill(email);
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

export const surveyData = {
  welcomeCard: {
    headline: "Welcome to My Testing Survey Welcome Card!",
    description: "This is the description of my Welcome Card!",
  },
  openTextQuestion: {
    question: "This is my Open Text Question",
    description: "This is my Open Text Description",
    placeholder: "This is my Placeholder",
  },
  singleSelectQuestion: {
    question: "This is my Single Select Question",
    description: "This is my Single Select Description",
    options: ["Option 1", "Option 2"],
  },
  multiSelectQuestion: {
    question: "This is my Multi Select Question",
    description: "This is Multi Select Description",
    options: ["Option 1", "Option 2", "Option 3"],
  },
  ratingQuestion: {
    question: "This is my Rating Question",
    description: "This is Rating Description",
    lowLabel: "My Lower Label",
    highLabel: "My Upper Label",
  },
  npsQuestion: {
    question: "This is my NPS Question",
    lowLabel: "My Lower Label",
    highLabel: "My Upper Label",
  },
  ctaQuestion: {
    question: "This is my CTA Question",
    buttonLabel: "My Button Label",
  },
  consentQuestion: {
    question: "This is my Consent Question",
    checkboxLabel: "My Checkbox Label",
  },
  pictureSelectQuestion: {
    question: "This is my Picture Select Question",
    description: "This is Picture Select Description",
  },
  fileUploadQuestion: {
    question: "This is my File Upload Question",
  },
  thankYouCard: {
    headline: "This is my Thank You Card Headline!",
    description: "This is my Thank you Card Description!",
  },
};
