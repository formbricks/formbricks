import { CreateSurveyParams } from "@/playwright/utils/mock";
import { expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
import { Page } from "playwright";

export const signUpAndLogin = async (
  page: Page,
  name: string,
  email: string,
  password: string
): Promise<void> => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByRole("button", { name: "Continue with Email" }).click();

  await expect(page.getByPlaceholder("Full Name")).toBeVisible();
  await page.getByPlaceholder("Full Name").fill(name);
  await page.getByPlaceholder("Full Name").press("Tab");

  await expect(page.getByPlaceholder("work@email.com")).toBeVisible();

  await page.getByPlaceholder("work@email.com").click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("work@email.com").press("Tab");

  await expect(page.getByPlaceholder("*******")).toBeVisible();

  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByText("Login").click();
  await page.getByRole("button", { name: "Login with Email" }).click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};

export const login = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto("/auth/login");

  await expect(page.getByRole("button", { name: "Login with Email" })).toBeVisible();

  await page.getByRole("button", { name: "Login with Email" }).click();

  await expect(page.getByPlaceholder("work@email.com")).toBeVisible();

  await page.getByPlaceholder("work@email.com").fill(email);

  await expect(page.getByPlaceholder("*******")).toBeVisible();

  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};

export const finishOnboarding = async (page: Page): Promise<void> => {
  await page.waitForURL("/onboarding");
  await expect(page).toHaveURL("/onboarding");

  const hiddenSkipButton = page.locator("#FB__INTERNAL__SKIP_ONBOARDING");
  hiddenSkipButton.evaluate((el: HTMLElement) => el.click());

  // await page.getByRole("button", { name: "In-app Surveys Run a survey" }).click();

  // await page.getByRole("button", { name: "Skip" }).click();
  // await page.getByRole("button", { name: "Skip" }).click();

  // await page.getByRole("button", { name: "I am not sure how to do this" }).click();
  // await page.locator("input").click();
  // await page.locator("input").fill("test@gmail.com");
  // await page.getByRole("button", { name: "Invite" }).click();
  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await expect(page.getByText("My Product")).toBeVisible();
};

export const replaceEnvironmentIdInHtml = (filePath: string, environmentId: string): string => {
  let htmlContent = readFileSync(filePath, "utf-8");
  htmlContent = htmlContent.replace(/environmentId: ".*?"/, `environmentId: "${environmentId}"`);

  writeFileSync(filePath, htmlContent);
  return "file:///" + filePath;
};

export const signupUsingInviteToken = async (page: Page, name: string, email: string, password: string) => {
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByPlaceholder("Full Name").fill(name);
  await page.getByPlaceholder("Full Name").press("Tab");

  // the email is already filled in the input field
  const inputValue = await page.getByPlaceholder("work@email.com").inputValue();
  expect(inputValue).toEqual(email);
  await page.getByPlaceholder("work@email.com").press("Tab");
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.waitForTimeout(500);
  await page.getByText("Continue with Email").click();
  await page.getByText("Login").click();
  await page.getByRole("button", { name: "Login with Email" }).click();
  await page.getByPlaceholder("work@email.com").fill(email);
  await page.getByPlaceholder("*******").click();
  await page.getByPlaceholder("*******").fill(password);
  await page.getByRole("button", { name: "Login with Email" }).click();
};

export const createSurvey = async (
  page: Page,
  name: string,
  email: string,
  password: string,
  params: CreateSurveyParams
) => {
  const addQuestion = "Add QuestionAdd a new question to your survey";

  await signUpAndLogin(page, name, email, password);
  await finishOnboarding(page);

  await page.getByRole("heading", { name: "Start from Scratch" }).click();

  // Welcome Card
  await expect(page.locator("#welcome-toggle")).toBeVisible();
  await page.getByText("Welcome Card").click();
  await page.locator("#welcome-toggle").check();
  await page.getByLabel("Headline").fill(params.welcomeCard.headline);
  await page.locator("form").getByText("Thanks for providing your").fill(params.welcomeCard.description);
  await page.getByText("Welcome CardEnabled").click();

  // Open Text Question
  await page.getByRole("button", { name: "1 What would you like to know" }).click();
  await page.getByLabel("Question").fill(params.openTextQuestion.question);
  await page.getByLabel("Description").fill(params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);
  await page.getByRole("button", { name: params.openTextQuestion.question }).click();

  // Single Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Single-Select" }).click();
  await page.getByLabel("Question").fill(params.singleSelectQuestion.question);
  await page.getByLabel("Description").fill(params.singleSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.singleSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.singleSelectQuestion.options[1]);
  await page.getByRole("button", { name: 'Add "Other"', exact: true }).click();

  // Multi Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Multi-Select" }).click();
  await page.getByLabel("Question").fill(params.multiSelectQuestion.question);
  await page.getByRole("button", { name: "Add Description", exact: true }).click();
  await page.getByLabel("Description").fill(params.multiSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.multiSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.multiSelectQuestion.options[1]);
  await page.getByPlaceholder("Option 3").fill(params.multiSelectQuestion.options[2]);

  // Rating Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Rating" }).click();
  await page.getByLabel("Question").fill(params.ratingQuestion.question);
  await page.getByLabel("Description").fill(params.ratingQuestion.description);
  await page.getByPlaceholder("Not good").fill(params.ratingQuestion.lowLabel);
  await page.getByPlaceholder("Very satisfied").fill(params.ratingQuestion.highLabel);

  // NPS Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
  await page.getByLabel("Question").fill(params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page
    .locator("div")
    .filter({ hasText: /^Upper label$/ })
    .locator("#subheader")
    .fill(params.npsQuestion.highLabel);

  // CTA Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Call-to-Action" }).click();
  await page.getByPlaceholder("Your question here. Recall").fill(params.ctaQuestion.question);
  await page.getByPlaceholder("Finish").fill(params.ctaQuestion.buttonLabel);

  // Consent Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Consent" }).click();
  await page.getByLabel("Question").fill(params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // Picture Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Picture Selection" }).click();
  await page.getByLabel("Question").fill(params.pictureSelectQuestion.question);
  await page.getByLabel("Description").fill(params.pictureSelectQuestion.description);

  // File Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "File Upload" }).click();
  await page.getByLabel("Question").fill(params.fileUploadQuestion.question);

  // Thank You Card
  await page
    .locator("div")
    .filter({ hasText: /^Thank You CardShown$/ })
    .nth(1)
    .click();
  await page.getByLabel("Question").fill(params.thankYouCard.headline);
  await page.getByLabel("Description").fill(params.thankYouCard.description);
};
