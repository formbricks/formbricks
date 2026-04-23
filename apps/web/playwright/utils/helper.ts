import { expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "node:path";
import { Page } from "playwright";
import { logger } from "@formbricks/logger";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { CreateSurveyParams, CreateSurveyWithLogicParams } from "@/playwright/utils/mock";

const MOCK_STORAGE_UPLOAD_PATH = "/__playwright__/mock-storage-upload";
const MOCK_STORAGE_FILE_PATH = "/storage/playwright-mock";

type MockStorageFileFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
  publicAssetPath?: string;
};

export const PLAYWRIGHT_PICTURE_SELECTION_FILES: MockStorageFileFixture[] = [
  {
    name: "playwright-choice-1.png",
    mimeType: "image/png",
    buffer: readFileSync(resolve(process.cwd(), "apps/web/public/logo-transparent.png")),
    publicAssetPath: "/logo-transparent.png",
  },
  {
    name: "playwright-choice-2.png",
    mimeType: "image/png",
    buffer: readFileSync(resolve(process.cwd(), "apps/web/public/favicon/android-chrome-192x192.png")),
    publicAssetPath: "/favicon/android-chrome-192x192.png",
  },
];

const PLAYWRIGHT_STORAGE_FILE_FIXTURES = new Map(
  PLAYWRIGHT_PICTURE_SELECTION_FILES.map((file) => [file.name, file] as const)
);

const DEFAULT_MOCK_STORAGE_FILE_FIXTURE: MockStorageFileFixture = {
  name: "mock-file.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#0f172a"/><circle cx="32" cy="32" r="18" fill="#22c55e"/></svg>`,
    "utf8"
  ),
};

const getMockStorageFileUrl = (
  appOrigin: string,
  fileName: string,
  accessType: "public" | "private"
): string => {
  if (accessType === "public") {
    const fixture = PLAYWRIGHT_STORAGE_FILE_FIXTURES.get(fileName);

    if (fixture?.publicAssetPath) {
      return new URL(fixture.publicAssetPath, appOrigin).toString();
    }
  }

  return `${MOCK_STORAGE_FILE_PATH}/${accessType}/${encodeURIComponent(fileName)}`;
};

/**
 * Survey builder E2E tests exercise survey authoring and response flows.
 * They are not the right place to depend on browser reachability to a real object-storage sidecar,
 * especially when some CI browsers run remotely. Mock the storage boundary so these tests stay scoped
 * to survey behavior, while real storage compatibility is covered by dedicated smoke/integration checks.
 */
export const mockStorageUploads = async (page: Page): Promise<void> => {
  await page.route("**/api/v1/management/storage", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as { fileName?: string } | undefined;
    const fileName = payload?.fileName ?? "uploaded-file.bin";
    const appOrigin = new URL(route.request().url()).origin;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          signedUrl: `${appOrigin}${MOCK_STORAGE_UPLOAD_PATH}/${encodeURIComponent(fileName)}`,
          presignedFields: {
            key: fileName,
          },
          fileUrl: getMockStorageFileUrl(appOrigin, fileName, "public"),
          signingData: null,
          updatedFileName: fileName,
        },
      }),
    });
  });

  await page.route(
    (url) => {
      const pathname = url.pathname;
      const segments = pathname.split("/").filter(Boolean);

      return (
        segments.length === 5 &&
        segments[0] === "api" &&
        segments[1] === "v1" &&
        segments[2] === "client" &&
        segments[4] === "storage"
      );
    },
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      const payload = route.request().postDataJSON() as { fileName?: string } | undefined;
      const fileName = payload?.fileName ?? "uploaded-file.bin";
      const appOrigin = new URL(route.request().url()).origin;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            signedUrl: `${appOrigin}${MOCK_STORAGE_UPLOAD_PATH}/${encodeURIComponent(fileName)}`,
            presignedFields: {
              key: fileName,
            },
            fileUrl: getMockStorageFileUrl(appOrigin, fileName, "private"),
            signingData: null,
            updatedFileName: fileName,
          },
        }),
      });
    }
  );

  await page.route(`**${MOCK_STORAGE_UPLOAD_PATH}/**`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><PostResponse><Location>${MOCK_STORAGE_UPLOAD_PATH}</Location></PostResponse>`,
    });
  });

  await page.route(`**${MOCK_STORAGE_FILE_PATH}/**`, async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      await route.fallback();
      return;
    }

    const fileName = decodeURIComponent(route.request().url().split("/").pop() ?? "");
    const fixture = PLAYWRIGHT_STORAGE_FILE_FIXTURES.get(fileName) ?? DEFAULT_MOCK_STORAGE_FILE_FIXTURE;

    await route.fulfill({
      status: 200,
      contentType: fixture.mimeType,
      body: route.request().method() === "HEAD" ? "" : fixture.buffer,
    });
  });
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

export const waitForPendingFileUploads = async (page: Page): Promise<void> => {
  await expect(page.locator("svg.animate-spin.text-slate-700")).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByText("Some files failed to upload")).toHaveCount(0);
  await expect(page.getByText("No files were uploaded")).toHaveCount(0);
  await expect(page.getByText("Invalid file name, please rename your file and try again")).toHaveCount(0);
};

export const uploadImageChoicesForPictureSelection = async (page: Page) => {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(PLAYWRIGHT_PICTURE_SELECTION_FILES);

  try {
    await waitForPendingFileUploads(page);
  } catch (error) {
    logger.error(error, "Error waiting for file uploads to finish");
    throw error;
  }
};

export const finishOnboarding = async (
  page: Page,
  projectChannel: TProjectConfigChannel = "website"
): Promise<void> => {
  await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/mode/);

  await page.getByRole("button", { name: "Formbricks Surveys Multi-" }).click();

  if (projectChannel === "app") {
    await page.getByRole("button", { name: "In-product surveys" }).click();
  } else {
    await page.getByRole("button", { name: "Link & email surveys" }).click();
  }

  // await page.getByRole("button", { name: "Proven methods SaaS" }).click();
  await page.getByPlaceholder("e.g. Formbricks").click();
  await page.getByPlaceholder("e.g. Formbricks").fill("My Workspace");
  await page.locator("#form-next-button").click();

  if (projectChannel !== "link") {
    await page.getByRole("button", { name: "I will do it later" }).click();
  }

  await page.waitForURL(/\/environments\/[^/]+\/surveys/);
  await expect(page.getByText("My Workspace")).toBeVisible();
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

/**
 * Fill a plain text translation in the Manage Translations modal.
 * Targets the row by data-testid which includes the translation path.
 */
export const fillModalTranslation = async (page: Page, path: string, text: string): Promise<void> => {
  const row = page.locator(`[data-testid="translation-row-${path}"]`);
  await row.scrollIntoViewIfNeeded();
  const input = row.locator("input");
  await input.fill(text);
};

/**
 * Fill a rich text translation in the Manage Translations modal.
 */
export const fillModalRichTranslation = async (page: Page, path: string, text: string): Promise<void> => {
  const row = page.locator(`[data-testid="translation-row-${path}"]`);
  await row.scrollIntoViewIfNeeded();
  const editor = row.locator(".editor-input").first();
  await editor.click();
  await editor.press("Meta+a");
  await editor.press("Backspace");
  await editor.pressSequentially(text, { delay: 50 });
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
  await page.getByRole("button", { name: "Add “Other”", exact: true }).click();

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

  await uploadImageChoicesForPictureSelection(page);

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
  await page.getByRole("button", { name: "Add “Other”", exact: true }).click();

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
  await uploadImageChoicesForPictureSelection(page);

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
