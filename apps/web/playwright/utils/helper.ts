import { CreateSurveyParams } from "@/playwright/utils/mock";
import { expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
import { Page } from "playwright";
import { TProductConfigChannel } from "@formbricks/types/product";

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

export const apiLogin = async (page: Page, email: string, password: string) => {
  const csrfToken = await page
    .context()
    .request.get("/api/auth/csrf")
    .then((response) => response.json())
    .then((json) => json.csrfToken);
  const data = {
    email,
    password,
    callbackURL: "/",
    redirect: "true",
    json: "true",
    csrfToken,
  };

  return page.context().request.post("/api/auth/callback/credentials", {
    data,
  });
};

export const finishOnboarding = async (
  page: Page,
  ProductChannel: TProductConfigChannel = "website"
): Promise<void> => {
  await page.waitForURL(/\/organizations\/[^/]+\/products\/new\/channel/);

  if (ProductChannel === "website") {
    await page.getByRole("button", { name: "Built for scale Public website" }).click();
  } else if (ProductChannel === "app") {
    await page.getByRole("button", { name: "Enrich user profiles App with" }).click();
  } else {
    await page.getByRole("button", { name: "Anywhere online Link" }).click();
  }

  await page.getByRole("button", { name: "Proven methods SaaS" }).click();
  await page.getByPlaceholder("e.g. Formbricks").click();
  await page.getByPlaceholder("e.g. Formbricks").fill("My Product");
  await page.locator("form").filter({ hasText: "Brand colorMatch the main" }).getByRole("button").click();

  if (ProductChannel !== "link") {
    await page.getByRole("button", { name: "I don't know how to do it" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Not now" }).click();
  }

  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await expect(page.getByText("My Product")).toBeVisible();
};

export const replaceEnvironmentIdInHtml = (filePath: string, environmentId: string): string => {
  let htmlContent = readFileSync(filePath, "utf-8");
  htmlContent = htmlContent.replace(/environmentId: ".*?"/, `environmentId: "${environmentId}"`);

  writeFileSync(filePath, htmlContent, { mode: 1 });
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

export const createSurvey = async (page: Page, params: CreateSurveyParams) => {
  const addQuestion = "Add QuestionAdd a new question to your survey";

  await page.getByRole("button", { name: "Start from scratch Create a" }).click();
  await page.getByRole("button", { name: "Create survey", exact: true }).click();

  await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);

  // Welcome Card
  await expect(page.locator("#welcome-toggle")).toBeVisible();
  await page.getByText("Welcome Card").click();
  await page.locator("#welcome-toggle").check();
  await page.getByLabel("Note*").fill(params.welcomeCard.headline);
  await page.locator("form").getByText("Thanks for providing your").fill(params.welcomeCard.description);
  await page.getByText("Welcome CardOn").click();

  // Open Text Question
  await page.getByRole("main").getByText("What would you like to know?").click();

  await page.getByLabel("Question*").fill(params.openTextQuestion.question);
  await page.getByLabel("Description").fill(params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);

  await page.locator("p").filter({ hasText: params.openTextQuestion.question }).click();

  // Single Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Single-Select" }).click();
  await page.getByLabel("Question*").fill(params.singleSelectQuestion.question);
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
  await page.getByLabel("Question*").fill(params.multiSelectQuestion.question);
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
  await page.getByLabel("Question*").fill(params.ratingQuestion.question);
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
  await page.getByLabel("Question*").fill(params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page.getByLabel("Upper label").fill(params.npsQuestion.highLabel);

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
  await page.getByLabel("Question*").fill(params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // Picture Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Picture Selection" }).click();
  await page.getByLabel("Question*").fill(params.pictureSelectQuestion.question);
  await page.getByLabel("Description").fill(params.pictureSelectQuestion.description);

  // File Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "File Upload" }).click();
  await page.getByLabel("Question*").fill(params.fileUploadQuestion.question);

  // Fill Matrix question in german
  // File Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Matrix" }).click();
  await page.getByLabel("Question*").fill(params.matrix.question);
  await page.getByLabel("Description").fill(params.matrix.description);
  await page.locator("#row-0").click();
  await page.locator("#row-0").fill(params.matrix.rows[0]);
  await page.locator("#row-1").click();
  await page.locator("#row-1").fill(params.matrix.rows[1]);
  await page.locator("#row-2").click();
  await page.locator("#row-2").fill(params.matrix.rows[2]);
  await page.locator("#column-0").click();
  await page.locator("#column-0").fill(params.matrix.columns[0]);
  await page.locator("#column-1").click();
  await page.locator("#column-1").fill(params.matrix.columns[1]);
  await page.locator("#column-2").click();
  await page.locator("#column-2").fill(params.matrix.columns[2]);
  await page.locator("#column-3").click();
  await page.locator("#column-3").fill(params.matrix.columns[3]);

  // File Address Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addQuestion}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Address" }).click();
  await page.getByLabel("Question*").fill(params.address.question);

  // Thank You Card
  await page
    .locator("div")
    .filter({ hasText: /^Thank you!Ending card$/ })
    .nth(1)
    .click();
  await page.getByLabel("Note*").fill(params.thankYouCard.headline);
  await page.getByLabel("Description").fill(params.thankYouCard.description);
};
