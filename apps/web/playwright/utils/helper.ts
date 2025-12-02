import { expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
import { Page } from "playwright";
import { logger } from "@formbricks/logger";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { CreateSurveyParams, CreateSurveyWithLogicParams } from "@/playwright/utils/mock";

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

export const uploadFileForFileUploadQuestion = async (page: Page) => {
  try {
    const fileInput = page.locator('input[type="file"]');
    const response1 = await fetch("https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-1-small.jpg");
    const response2 = await fetch("https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-2-small.jpg");
    const buffer1 = Buffer.from(await response1.arrayBuffer());
    const buffer2 = Buffer.from(await response2.arrayBuffer());

    await fileInput.setInputFiles([
      {
        name: "puppy-1-small.jpg",
        mimeType: "image/jpeg",
        buffer: buffer1,
      },
      {
        name: "puppy-2-small.jpg",
        mimeType: "image/jpeg",
        buffer: buffer2,
      },
    ]);
  } catch (error) {
    logger.error(error, "Error uploading files");
  }
};

export const finishOnboarding = async (
  page: Page,
  projectChannel: TProjectConfigChannel = "website"
): Promise<void> => {
  await page.waitForURL(/\/organizations\/[^/]+\/projects\/new\/mode/);

  await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();

  if (projectChannel === "app") {
    await page.getByRole("button", { name: "In-product surveys" }).click();
  } else {
    await page.getByRole("button", { name: "Link & email surveys" }).click();
  }

  // await page.getByRole("button", { name: "Proven methods SaaS" }).click();
  await page.getByPlaceholder("e.g. Formbricks").click();
  await page.getByPlaceholder("e.g. Formbricks").fill("My Project");
  await page.locator("#form-next-button").click();

  if (projectChannel !== "link") {
    await page.getByRole("button", { name: "I'll do it later" }).click();
  }

  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await expect(page.getByText("My Project")).toBeVisible();
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

/**
 * Helper function to fill content into a rich text editor (contenteditable div).
 * The rich text editor uses a contenteditable div with class "editor-input" instead of a regular input.
 *
 * @param page - Playwright Page object
 * @param labelText - The label text to find the editor (e.g., "Note*", "Description")
 * @param content - The text content to fill into the editor
 */
export const fillRichTextEditor = async (page: Page, labelText: string, content: string): Promise<void> => {
  // Find the editor by locating the label and then finding the .editor-input within the same form group
  const label = page.locator(`label:has-text("${labelText}")`);
  const editorContainer = label.locator("..").locator("..");
  const editor = editorContainer.locator(".editor-input").first();

  await editor.click();
  // Clear existing content by selecting all and deleting
  await editor.press("Meta+a"); // Cmd+A on Mac, Ctrl+A is handled automatically by Playwright
  await editor.press("Backspace");
  // Type the new content
  await editor.pressSequentially(content, { delay: 50 });
};

export const createSurvey = async (page: Page, params: CreateSurveyParams) => {
  const addBlock = "Add BlockChoose the first question on your Block";

  await page.getByText("Start from scratch").click();
  await page.getByRole("button", { name: "Create survey", exact: true }).click();

  await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);

  // Welcome Card
  await expect(page.locator("#welcome-toggle")).toBeVisible();
  await page.getByText("Welcome Card").click();
  await page.locator("#welcome-toggle").check();

  // Use the helper function for rich text editors
  await fillRichTextEditor(page, "Note*", params.welcomeCard.headline);
  await fillRichTextEditor(page, "Welcome message", params.welcomeCard.description);

  await page.getByText("Welcome CardOn").click();

  // Open Text Question
  await page.getByRole("main").getByText("What would you like to know?").click();

  await fillRichTextEditor(page, "Question*", params.openTextQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);

  await page.locator("h3").filter({ hasText: params.openTextQuestion.question }).click();

  // Single Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Single-Select" }).click();
  await fillRichTextEditor(page, "Question*", params.singleSelectQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.singleSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.singleSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.singleSelectQuestion.options[1]);
  await page.getByRole("button", { name: 'Add "Other"', exact: true }).click();

  // Multi Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Multi-Select Ask respondents" }).click();
  await fillRichTextEditor(page, "Question*", params.multiSelectQuestion.question);
  await page.getByRole("button", { name: "Add description", exact: true }).click();
  await fillRichTextEditor(page, "Description", params.multiSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.multiSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.multiSelectQuestion.options[1]);
  await page.getByPlaceholder("Option 3").fill(params.multiSelectQuestion.options[2]);

  // Rating Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Rating" }).click();
  await fillRichTextEditor(page, "Question*", params.ratingQuestion.question);
  await page.getByRole("button", { name: "Add description", exact: true }).click();
  await fillRichTextEditor(page, "Description", params.ratingQuestion.description);
  await page.getByPlaceholder("Not good").fill(params.ratingQuestion.lowLabel);
  await page.getByPlaceholder("Very satisfied").fill(params.ratingQuestion.highLabel);

  // NPS Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
  await fillRichTextEditor(page, "Question*", params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page.getByLabel("Upper label").fill(params.npsQuestion.highLabel);

  // CTA Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Statement (Call to Action)" }).click();
  await fillRichTextEditor(page, "Question*", params.ctaQuestion.question);

  // Enable external button and fill URL
  await page.locator("#buttonExternal").check();
  await page.getByRole("textbox", { name: "https://website.com" }).fill("https://example.com");
  await page.getByPlaceholder("Finish").fill(params.ctaQuestion.buttonLabel);

  // Consent Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Consent" }).click();
  await fillRichTextEditor(page, "Question*", params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // Picture Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Picture Selection" }).click();
  await fillRichTextEditor(page, "Question*", params.pictureSelectQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.pictureSelectQuestion.description);

  // Handle file uploads
  await uploadFileForFileUploadQuestion(page);

  // File Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "File Upload" }).click();
  await fillRichTextEditor(page, "Question*", params.fileUploadQuestion.question);

  // Matrix Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Matrix" }).click();
  await fillRichTextEditor(page, "Question*", params.matrix.question);
  await page.getByRole("button", { name: "Add description", exact: true }).click();
  await fillRichTextEditor(page, "Description", params.matrix.description);
  await page.locator("#row-0").click();
  await page.locator("#row-0").fill(params.matrix.rows[0]);
  await page.locator("#row-1").click();
  await page.locator("#row-1").fill(params.matrix.rows[1]);
  await page.getByRole("button", { name: "Add row" }).click();
  await page.locator("#row-2").click();
  await page.locator("#row-2").fill(params.matrix.rows[2]);
  await page.locator("#column-0").click();
  await page.locator("#column-0").fill(params.matrix.columns[0]);
  await page.locator("#column-1").click();
  await page.locator("#column-1").fill(params.matrix.columns[1]);
  await page.getByRole("button", { name: "Add column" }).click();
  await page.locator("#column-2").click();
  await page.locator("#column-2").fill(params.matrix.columns[2]);
  await page.getByRole("button", { name: "Add column" }).click();
  await page.locator("#column-3").click();
  await page.locator("#column-3").fill(params.matrix.columns[3]);

  // Fill Address Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Address" }).click();
  await fillRichTextEditor(page, "Question*", params.address.question);
  await page.getByRole("row", { name: "Address Line 2" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "City" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "State" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Zip" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "Country" }).getByRole("switch").nth(1).click();

  // Fill Contact Info Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Contact Info" }).click();
  await fillRichTextEditor(page, "Question*", params.contactInfo.question);
  await page.getByRole("row", { name: "Last Name" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Email" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Phone" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Company" }).getByRole("switch").nth(1).click();

  // Fill Ranking question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Ranking" }).click();
  await fillRichTextEditor(page, "Question*", params.ranking.question);
  await page.getByPlaceholder("Option 1").click();
  await page.getByPlaceholder("Option 1").fill(params.ranking.choices[0]);
  await page.getByPlaceholder("Option 2").click();
  await page.getByPlaceholder("Option 2").fill(params.ranking.choices[1]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 3").click();
  await page.getByPlaceholder("Option 3").fill(params.ranking.choices[2]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 4").click();
  await page.getByPlaceholder("Option 4").fill(params.ranking.choices[3]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 5").click();
  await page.getByPlaceholder("Option 5").fill(params.ranking.choices[4]);
};

export const createSurveyWithLogic = async (page: Page, params: CreateSurveyWithLogicParams) => {
  const addBlock = "Add BlockChoose the first question on your Block";

  await page.getByText("Start from scratch").click();
  await page.getByRole("button", { name: "Create survey", exact: true }).click();

  await page.waitForURL(/\/environments\/[^/]+\/surveys\/[^/]+\/edit$/);

  // Add variables
  await page.getByText("Variables").click();
  await page.getByPlaceholder("Field name e.g, score, price").click();
  await page.getByPlaceholder("Field name e.g, score, price").fill("score");
  await page.getByRole("button", { name: "Add variable" }).click();
  await page
    .locator("form")
    .filter({ hasText: "Add variable" })
    .getByPlaceholder("Field name e.g, score, price")
    .fill("secret");
  await page.locator("form").filter({ hasText: "Add variable" }).getByRole("combobox").click();
  await page.getByLabel("Text", { exact: true }).click();
  await page.getByRole("button", { name: "Add variable" }).click();

  // Welcome Card
  await expect(page.locator("#welcome-toggle")).toBeVisible();
  await page.getByText("Welcome Card").click();
  await page.locator("#welcome-toggle").check();

  // Use the helper function for rich text editors
  await fillRichTextEditor(page, "Note*", params.welcomeCard.headline);
  await fillRichTextEditor(page, "Welcome message", params.welcomeCard.description);

  await page.getByText("Welcome CardOn").click();

  // Open Text Question
  await page.getByRole("main").getByText("What would you like to know?").click();

  await fillRichTextEditor(page, "Question*", params.openTextQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);

  await page.locator("h3").filter({ hasText: params.openTextQuestion.question }).click();

  // Single Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Single-Select" }).click();
  await fillRichTextEditor(page, "Question*", params.singleSelectQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.singleSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.singleSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.singleSelectQuestion.options[1]);
  await page.getByRole("button", { name: 'Add "Other"', exact: true }).click();

  // Multi Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Multi-Select Ask respondents" }).click();
  await fillRichTextEditor(page, "Question*", params.multiSelectQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.multiSelectQuestion.description);
  await page.getByPlaceholder("Option 1").fill(params.multiSelectQuestion.options[0]);
  await page.getByPlaceholder("Option 2").fill(params.multiSelectQuestion.options[1]);
  await page.getByPlaceholder("Option 3").fill(params.multiSelectQuestion.options[2]);

  // Picture Select Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Picture Selection" }).click();
  await fillRichTextEditor(page, "Question*", params.pictureSelectQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.pictureSelectQuestion.description);
  const fileInput = page.locator('input[type="file"]');
  const response1 = await fetch("https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-1-small.jpg");
  const response2 = await fetch("https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-2-small.jpg");
  const buffer1 = Buffer.from(await response1.arrayBuffer());
  const buffer2 = Buffer.from(await response2.arrayBuffer());

  await fileInput.setInputFiles([
    {
      name: "puppy-1-small.jpg",
      mimeType: "image/jpeg",
      buffer: buffer1,
    },
    {
      name: "puppy-2-small.jpg",
      mimeType: "image/jpeg",
      buffer: buffer2,
    },
  ]);

  // Rating Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Rating" }).click();
  await fillRichTextEditor(page, "Question*", params.ratingQuestion.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.ratingQuestion.description);
  await page.getByPlaceholder("Not good").fill(params.ratingQuestion.lowLabel);
  await page.getByPlaceholder("Very satisfied").fill(params.ratingQuestion.highLabel);

  // NPS Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Net Promoter Score (NPS)" }).click();
  await fillRichTextEditor(page, "Question*", params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page.getByLabel("Upper label").fill(params.npsQuestion.highLabel);

  // Fill Ranking question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Ranking" }).click();
  await fillRichTextEditor(page, "Question*", params.ranking.question);
  await page.getByPlaceholder("Option 1").click();
  await page.getByPlaceholder("Option 1").fill(params.ranking.choices[0]);
  await page.getByPlaceholder("Option 2").click();
  await page.getByPlaceholder("Option 2").fill(params.ranking.choices[1]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 3").click();
  await page.getByPlaceholder("Option 3").fill(params.ranking.choices[2]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 4").click();
  await page.getByPlaceholder("Option 4").fill(params.ranking.choices[3]);
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByPlaceholder("Option 5").click();
  await page.getByPlaceholder("Option 5").fill(params.ranking.choices[4]);

  // Matrix Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Matrix" }).click();
  await fillRichTextEditor(page, "Question*", params.matrix.question);
  await page.getByRole("button", { name: "Add description" }).click();
  await fillRichTextEditor(page, "Description", params.matrix.description);
  await page.locator("#row-0").click();
  await page.locator("#row-0").fill(params.matrix.rows[0]);
  await page.locator("#row-1").click();
  await page.locator("#row-1").fill(params.matrix.rows[1]);
  await page.getByRole("button", { name: "Add row" }).click();
  await page.locator("#row-2").click();
  await page.locator("#row-2").fill(params.matrix.rows[2]);
  await page.locator("#column-0").click();
  await page.locator("#column-0").fill(params.matrix.columns[0]);
  await page.locator("#column-1").click();
  await page.locator("#column-1").fill(params.matrix.columns[1]);
  await page.getByRole("button", { name: "Add column" }).click();
  await page.locator("#column-2").click();
  await page.locator("#column-2").fill(params.matrix.columns[2]);
  await page.getByRole("button", { name: "Add column" }).click();
  await page.locator("#column-3").click();
  await page.locator("#column-3").fill(params.matrix.columns[3]);

  // CTA Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Statement (Call to Action)" }).click();
  await fillRichTextEditor(page, "Question*", params.ctaQuestion.question);

  // Enable external button and fill URL
  await page.locator("#buttonExternal").check();
  await page.getByRole("textbox", { name: "https://website.com" }).fill("https://example.com");
  await page.getByPlaceholder("Finish").fill(params.ctaQuestion.buttonLabel);

  // Consent Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Consent" }).click();
  await fillRichTextEditor(page, "Question*", params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // File Upload Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "File Upload" }).click();
  await fillRichTextEditor(page, "Question*", params.fileUploadQuestion.question);

  // Date Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Date" }).click();
  await fillRichTextEditor(page, "Question*", params.date.question);

  // Cal Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Schedule a meeting" }).click();
  await fillRichTextEditor(page, "Question*", params.cal.question);

  // Fill Address Question
  await page
    .locator("div")
    .filter({ hasText: new RegExp(`^${addBlock}$`) })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Address" }).click();
  await fillRichTextEditor(page, "Question*", params.address.question);
  await page.getByRole("row", { name: "Address Line 2" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "City" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "State" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Zip" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "Country" }).getByRole("switch").nth(1).click();

  // Adding logic to blocks
  // Block 1 (Open Text Question)
  await page.getByRole("heading", { name: params.openTextQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").first().click();
  await page.getByRole("option", { name: params.openTextQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").first().click();
  await page.getByRole("option", { name: "is submitted" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").first().click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").first().click();
  await page.getByRole("option", { name: "Assign =" }).click();
  await page.locator("#action-0-value-input").first().click();
  await page.locator("#action-0-value-input").first().fill("1");
  await page.locator("#actions-0-dropdown").first().click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Require Answer" }).click();
  await page.locator("#action-1-target").click();
  await page.getByRole("option", { name: params.singleSelectQuestion.question }).click();
  await page.locator("#actions-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-2-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-2-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-2-operator").click();
  await page.getByRole("option", { name: "Assign =" }).click();
  await page.locator("#action-2-value-input").click();
  await page.locator("#action-2-value-input").fill("This ");
  // Close Block 1 settings before moving to Block 2
  await page
    .locator("div")
    .filter({ hasText: /^Block 11 question$/ })
    .first()
    .click();

  // Block 2 (Single Select Question)
  await page.getByRole("heading", { name: params.singleSelectQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").first().click();
  await page.getByRole("option", { name: params.singleSelectQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").first().click();
  await page.getByRole("option", { name: "Equals one of" }).click();
  await page.locator("#condition-0-0-conditionMatchValue").first().click();
  await page.getByRole("option", { name: params.singleSelectQuestion.options[0] }).click();
  await page.getByRole("option", { name: params.singleSelectQuestion.options[1] }).click();
  await page.locator("html").click();
  await page.waitForSelector('[data-testid="dropdown-menu-content"]', { state: "hidden", timeout: 3000 });
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("is ");
  // Close Block 2 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 21 question$/ })
    .first()
    .click();

  // Block 3 (Multi Select Question)
  await page.getByRole("heading", { name: params.multiSelectQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.multiSelectQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: "Includes all of" }).click();
  await page.locator("#condition-0-0-conditionMatchValue").click();
  await page.getByRole("option", { name: params.multiSelectQuestion.options[0] }).click();
  await page.getByRole("option", { name: params.multiSelectQuestion.options[1] }).click();
  await page.getByRole("option", { name: params.multiSelectQuestion.options[2] }).click();
  await page.locator("html").click();
  await page.waitForSelector('[data-testid="dropdown-menu-content"]', { state: "hidden", timeout: 3000 });
  await page.locator("#condition-0-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-1-conditionValue").click();
  await page.getByRole("option", { name: params.singleSelectQuestion.question }).click();
  await page.locator("#condition-0-1-conditionOperator").click();
  await page.getByRole("option", { name: "is submitted" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Require Answer" }).click();
  await page.locator("#action-1-target").click();
  await page.getByRole("option", { name: params.pictureSelectQuestion.question }).click();
  await page.locator("#actions-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-2-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-2-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-2-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("a ");
  // Close Block 3 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 31 question$/ })
    .first()
    .click();

  // Block 4 (Picture Select Question)
  await page.getByRole("heading", { name: params.pictureSelectQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.pictureSelectQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: "is submitted" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("secret ");
  // Close Block 4 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 41 question$/ })
    .first()
    .click();

  // Block 5 (Rating Question)
  await page.getByRole("heading", { name: params.ratingQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.ratingQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: ">=" }).click();
  await page.locator("#condition-0-0-conditionMatchValue").click();
  await page.getByRole("option", { name: "3" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("message ");
  // Close Block 5 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 51 question$/ })
    .first()
    .click();

  // Block 6 (NPS Question)
  await page.getByRole("heading", { name: params.npsQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.npsQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: ">", exact: true }).click();
  await page.locator("#condition-0-0-conditionMatchValue").click();
  await page.getByRole("option", { name: "2" }).click();
  await page.locator("#condition-0-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-1-conditionValue").click();
  await page.getByRole("option", { name: params.npsQuestion.question }).click();
  await page.locator("#condition-0-1-conditionOperator").click();
  await page.getByRole("option", { name: "<", exact: true }).click();
  await page.locator("#condition-0-1-conditionMatchValue").click();
  await page.getByRole("option", { name: "8" }).click();
  await page.locator("#condition-0-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-2-conditionValue").click();
  await page.getByRole("option", { name: params.ratingQuestion.question }).click();
  await page.locator("#condition-0-2-conditionOperator").click();
  await page.getByRole("option", { name: "=", exact: true }).click();
  await page.locator("#condition-0-2-conditionMatchValue").click();
  await page.getByRole("option", { name: "4" }).click();
  await page.locator("#condition-0-2-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-3-conditionValue").click();
  await page.getByRole("option", { name: params.ratingQuestion.question }).click();
  await page.locator("#condition-0-3-conditionOperator").click();
  await page.getByRole("option", { name: "<=" }).click();
  await page.locator("#condition-0-3-conditionMatchValue").click();
  await page.getByRole("option", { name: "1" }).click();
  await page.locator("#condition-0-3-dropdown").click();
  await page.getByRole("menuitem", { name: "Create group" }).click();
  await page.locator("#condition-1-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();

  await page.getByRole("combobox").filter({ hasText: "all are true" }).nth(1).click();
  await page.getByText("any is true").click();

  await page.locator("#condition-1-1-conditionValue").click();
  await page
    .getByRole("option")
    .filter({ hasText: new RegExp(`^${params.pictureSelectQuestion.question}$`) })
    .click();
  await page.locator("#condition-1-1-conditionOperator").click();
  await page.getByRole("option", { name: "is submitted" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("for ");
  // Close Block 6 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 61 question$/ })
    .first()
    .click();

  // Block 7 (Ranking Question)
  await page.getByRole("heading", { name: params.ranking.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.ranking.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: "is skipped" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("e2e ");
  // Close Block 7 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 71 question$/ })
    .first()
    .click();

  // Block 8 (Matrix Question)
  await page.getByRole("heading", { name: params.matrix.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").first().click();
  await page.getByTestId("dropdown-menu-content").getByText(params.matrix.question).click();
  await page.getByRole("menuitem", { name: "All fields" }).click();
  // Click the operator dropdown (currently shows "Is partially submitted")
  await page.getByText("Is partially submitted").click();
  // Select "Is completely submitted" from the dropdown
  await page.getByText("Is completely submitted").click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Concat +" }).click();
  await page.getByRole("textbox", { name: "Value" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill("tests");
  await page.locator("#actions-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-2-objective").click();
  await page.getByRole("option", { name: "Require Answer" }).click();
  await page.locator("#action-2-target").click();
  await page.getByRole("option", { name: params.ctaQuestion.question }).click();
  // Close Block 8 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 81 question$/ })
    .first()
    .click();

  // Block 9 (CTA Question)
  await page.getByRole("heading", { name: params.ctaQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.ctaQuestion.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: "is not clicked" }).click();
  await page.locator("#condition-0-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.getByRole("combobox").filter({ hasText: "all are true" }).first().click();
  await page.getByText("any is true").click();
  await page.locator("#condition-0-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Create group" }).click();
  await page.locator("#condition-1-0-conditionValue").click();
  await page.getByRole("option", { name: params.ctaQuestion.question }).click();
  await page.locator("#condition-1-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-1-1-conditionValue").click();
  await page.getByRole("option", { name: "secret" }).click();
  await page.locator("#condition-1-1-conditionOperator").click();
  await page.getByRole("option", { name: "contains" }).click();
  await page.getByPlaceholder("Value").click();
  await page.getByPlaceholder("Value").fill("test");
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("1");
  // Close Block 9 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 91 question$/ })
    .first()
    .click();

  // Block 10 (Consent Question)
  await page.getByRole("heading", { name: params.consentQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("2");
  // Close Block 10 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 101 question$/ })
    .first()
    .click();

  // Block 11 (File Upload Question)
  await page.getByRole("heading", { name: params.fileUploadQuestion.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("1");
  // Close Block 11 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 111 question$/ })
    .first()
    .click();

  // Block 12 (Date Question)
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0];
  const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0];

  await page.getByRole("main").getByText(params.date.question).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();

  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.date.question }).click();
  await page.getByPlaceholder("Value").fill(today);
  await page.locator("#condition-0-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-1-conditionValue").click();
  await page.getByRole("option", { name: params.date.question }).click();
  await page.locator("#condition-0-1-conditionOperator").click();
  await page.getByRole("option", { name: "does not equal" }).click();
  await page.locator("#condition-0-1-conditionMatchValue-input").fill(yesterday);
  await page.locator("#condition-0-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-2-conditionValue").click();
  await page.getByRole("option", { name: params.date.question }).click();
  await page.locator("#condition-0-2-conditionOperator").click();
  await page.getByRole("option", { name: "is before" }).click();
  await page.locator("#condition-0-2-conditionMatchValue-input").fill(tomorrow);
  await page.locator("#condition-0-2-dropdown").click();
  await page.getByRole("menuitem", { name: "Add condition below" }).click();
  await page.locator("#condition-0-3-conditionValue").click();
  await page.getByRole("option", { name: params.date.question }).click();
  await page.locator("#condition-0-3-conditionOperator").click();
  await page.getByRole("option", { name: "is after" }).click();
  await page.locator("#condition-0-3-conditionMatchValue-input").fill(yesterday);
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("1");
  // Close Block 12 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 121 question$/ })
    .first()
    .click();

  // Block 13 (Cal Question)
  await page.getByRole("heading", { name: params.cal.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#condition-0-0-conditionValue").click();
  await page.getByRole("option", { name: params.cal.question }).click();
  await page.locator("#condition-0-0-conditionOperator").click();
  await page.getByRole("option", { name: "is skipped" }).click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("1");
  // Close Block 13 settings
  await page
    .locator("div")
    .filter({ hasText: /^Block 131 question$/ })
    .first()
    .click();

  // Block 14 (Address Question)
  await page.getByRole("heading", { name: params.address.question }).click();
  await page.getByText("Show Block settings").first().click();
  await page.getByRole("button", { name: "Add logic" }).first().click();
  await page.locator("#action-0-objective").first().click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-0-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-0-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-0-value-input").click();
  await page.locator("#action-0-value-input").fill("1");
  await page.locator("#actions-0-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-1-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-1-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-1-operator").click();
  await page.getByRole("option", { name: "Add +" }).click();
  await page.locator("#action-1-value-input").click();
  await page.locator("#action-1-value-input").fill("1");
  await page.locator("#actions-1-dropdown").click();
  await page.getByRole("menuitem", { name: "Add action below" }).click();
  await page.locator("#action-2-objective").click();
  await page.getByRole("option", { name: "Calculate" }).click();
  await page.locator("#action-2-variableId").click();
  await page.getByRole("option", { name: "score" }).click();
  await page.locator("#action-2-operator").click();
  await page.getByRole("option", { name: "Multiply *" }).click();
  await page.locator("#action-2-value-input").click();
  await page.locator("#action-2-value-input").fill("2");
};
