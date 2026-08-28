import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Locator, Page } from "playwright";
import { logger } from "@formbricks/logger";
import { CreateSurveyParams, CreateSurveyWithLogicParams } from "@/playwright/utils/mock";

const MOCK_STORAGE_UPLOAD_PATH = "/__playwright__/mock-storage-upload";
const SURVEY_CREATE_API_PATHS = new Set(["/api/v3/surveys", "/api/v3/surveys/templates"]);

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

export const waitForSurveyCreateResponse = async (page: Page): Promise<string> => {
  const response = await page.waitForResponse((response) => {
    const url = new URL(response.url());

    return SURVEY_CREATE_API_PATHS.has(url.pathname) && response.request().method() === "POST";
  });
  const responseBody = await response.json().catch(() => null);
  expect(response.status(), JSON.stringify(responseBody)).toBe(201);

  const surveyId = (responseBody as { data?: { id?: unknown } } | null)?.data?.id;
  if (typeof surveyId !== "string") {
    throw new TypeError("Survey create response did not include a survey id");
  }

  return surveyId;
};

export const waitForSurveyEditor = async (
  page: Page,
  surveyId: string,
  options: { mode?: "cx" } = {}
): Promise<void> => {
  const editorUrlPattern = new RegExp(`/workspaces/[^/]+/surveys/${surveyId}/edit(?:\\?.*)?$`);
  const currentUrl = new URL(page.url());

  if (!editorUrlPattern.test(`${currentUrl.pathname}${currentUrl.search}`)) {
    await page.waitForURL(editorUrlPattern);
  }

  if (options.mode === "cx") {
    await expect(page).toHaveURL(
      new RegExp(String.raw`/workspaces/[^/]+/surveys/${surveyId}/edit\?.*mode=cx`)
    );
    await expect(page.getByRole("button", { name: "Save & Close", exact: true })).toBeVisible();
    return;
  }

  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
};

export const createSurveyFromScratch = async (page: Page, options: { mode?: "cx" } = {}): Promise<string> => {
  const createResponse = waitForSurveyCreateResponse(page);
  const createSurveyButton = page.getByRole("button", { name: "Create survey", exact: true });
  const startFromScratchButton = page.getByText("Start from scratch", { exact: true }).first();

  if (await createSurveyButton.isVisible().catch(() => false)) {
    await createSurveyButton.click();
  } else if (await startFromScratchButton.isVisible().catch(() => false)) {
    await startFromScratchButton.click();

    const createSurveyButtonAppeared = await Promise.race([
      createSurveyButton
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false),
      createResponse.then(() => false),
    ]);

    if (createSurveyButtonAppeared) {
      await createSurveyButton.click();
    }
  } else {
    await page.getByRole("button", { name: "New Survey" }).click();
    await page.getByRole("menuitem", { name: "Start from scratch" }).click();
  }

  const surveyId = await createResponse;
  await waitForSurveyEditor(page, surveyId, options);
  await expect(page.getByRole("main").getByText("What would you like to know?").first()).toBeVisible();

  return surveyId;
};

export const useSelectedTemplate = async (page: Page): Promise<string> => {
  const createResponse = waitForSurveyCreateResponse(page);
  await page.getByRole("button", { name: "Use this template", exact: true }).click();
  const surveyId = await createResponse;
  await waitForSurveyEditor(page, surveyId);

  return surveyId;
};

export const createXMTemplateSurvey = async (page: Page, templateName: RegExp | string): Promise<string> => {
  const createResponse = waitForSurveyCreateResponse(page);
  await page.getByRole("button", { name: templateName, exact: typeof templateName === "string" }).click();
  const surveyId = await createResponse;
  await waitForSurveyEditor(page, surveyId, { mode: "cx" });

  return surveyId;
};

const getMockStorageFileUrl = ({
  appOrigin,
  fileName,
  accessType,
  storageId = "playwright-mock",
  filePathSegments = [],
}: {
  appOrigin: string;
  fileName: string;
  accessType: "public" | "private";
  storageId?: string;
  filePathSegments?: string[];
}): string => {
  if (accessType === "public") {
    const fixture = PLAYWRIGHT_STORAGE_FILE_FIXTURES.get(fileName);

    if (fixture?.publicAssetPath) {
      return new URL(fixture.publicAssetPath, appOrigin).toString();
    }
  }

  return `/storage/${storageId}/${accessType}/${[...filePathSegments, encodeURIComponent(fileName)].join("/")}`;
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
          fileUrl: getMockStorageFileUrl({ appOrigin, fileName, accessType: "public" }),
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

      const payload = route.request().postDataJSON() as
        | { fileName?: string; surveyId?: string; elementId?: string }
        | undefined;
      const fileName = payload?.fileName ?? "uploaded-file.bin";
      const requestUrl = new URL(route.request().url());
      const appOrigin = requestUrl.origin;
      const workspaceId = requestUrl.pathname.split("/").filter(Boolean)[3] ?? "playwright-mock";
      const filePathSegments =
        payload?.surveyId && payload?.elementId
          ? ["surveys", payload.surveyId, "elements", payload.elementId]
          : [];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            signedUrl: `${appOrigin}${MOCK_STORAGE_UPLOAD_PATH}/${encodeURIComponent(fileName)}`,
            presignedFields: {
              key: fileName,
            },
            fileUrl: getMockStorageFileUrl({
              appOrigin,
              fileName,
              accessType: "private",
              storageId: workspaceId,
              filePathSegments,
            }),
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

  await page.route("**/storage/**", async (route) => {
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
  // Better Auth sign-in (replaces the NextAuth csrf + credentials-callback flow). The signed session
  // cookie set on the response is shared with the browser through Playwright's request/context jar.
  return page.context().request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
};

export const isWorkspaceStorageConfigured = async (page: Page, workspaceId: string): Promise<boolean> => {
  const response = await page.context().request.post("/api/v1/management/storage", {
    data: {
      fileName: "e2e-storage-check.png",
      fileType: "image/png",
      workspaceId,
    },
  });

  return response.ok();
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

export const finishOnboarding = async (page: Page): Promise<void> => {
  await page.waitForURL(/\/organizations\/[^/]+\/workspaces\/new\/survey/);
  await page.getByRole("button", { name: "Start from scratch" }).click();

  await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/edit(\?.*)mode=cx/);
  await page.getByRole("button", { name: "Save & Close" }).click();

  await page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/);
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
 * Wait for the previous interaction to reach the survey state, then for a frame after it.
 *
 * `ElementFormInput` pushes edits upstream through `debounce(handleUpdate, 100)`
 * (apps/web/modules/survey/components/element-form-input/index.tsx), and the editor's add handlers
 * (`handleAddLabel`, `updateChoice`, `addElement`, the "Add description"/"Add “Other”" buttons) each
 * build their payload from the `element`/`survey` prop of the render they were created in. A
 * structural click that lands before that debounce has fired writes a stale array back and silently
 * drops the edit — what the spec-wide `slowMo: 150` was really paying for.
 *
 * Order matters: the sleep clears the 100ms debounce, and the two animation frames then confirm the
 * resulting commit has painted. Frames first would resolve at ~16/32ms — before the debounce had
 * even run — and guarantee nothing. Cost is ~180ms at each of the ~40 structural seams, against
 * 150ms on every one of the spec's 726 actions.
 */
const RENDER_SETTLE_MS = 150;

const flushRender = async (page: Page): Promise<void> => {
  await page.evaluate(
    (settleMs) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }, settleMs);
      }),
    RENDER_SETTLE_MS
  );
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

  // Waiting for the editor before touching it is what lets this run without a global `slowMo`: the
  // element card mounts its form asynchronously after an element is added, so an unguarded action
  // used to resolve against the outgoing render and fail as a detached node.
  await expect(editor).toBeVisible();
  // `fill` on the contenteditable, not `pressSequentially`. One `insertText` replaces the whole
  // value, where per-key typing raced Lexical's own re-render and truncated the text ("Picture
  // Select Question" landing as "Picture S") unless every keystroke was paced by `slowMo`.
  await editor.fill(content);
  // Confirms the editor settled before the caller's next action — this assertion, not a delay, is
  // what keeps the following interactions off a mid-render tree.
  await expect(editor).toHaveText(content);
  await flushRender(page);
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
  await expect(editor).toBeVisible();
  await editor.fill(text);
  await expect(editor).toHaveText(text);
};

/** Reveal an element's description field. Structural, so the pending edit is flushed first. */
const addDescription = async (page: Page, options: { exact?: boolean } = {}) => {
  await flushRender(page);
  await page.getByRole("button", { name: "Add description", exact: options.exact ?? false }).click();
  await expect(page.locator('label:has-text("Description")').first()).toBeVisible();
};

/** Append the "Other" choice to a select element. Structural, so flush first. */
const addOtherChoice = async (page: Page) => {
  await flushRender(page);
  await page.getByRole("button", { name: "Add “Other”", exact: true }).click();
  await expect(page.getByPlaceholder("Other", { exact: true })).toBeVisible();
};

/**
 * Add an element to the survey via the editor's "Add Block" collapsible.
 *
 * Every step asserts the state it depends on, which is what replaced the spec-wide `slowMo: 150`:
 * the collapsible animates open and shut (`animate-collapsible-down`/`-up`) while the new element
 * card mounts, so an unguarded "click trigger, click type" pair raced the animation and the React
 * commit, and failed with "element detached from the DOM".
 */
export const addElement = async (page: Page, elementType: string, options: { exact?: boolean } = {}) => {
  const trigger = page.getByTestId("add-element-trigger");

  // The add rebuilds the element list from the current render — let the previous edit commit first.
  await flushRender(page);
  await expect(trigger).toBeVisible();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  // Radix flips `data-state` on the trigger, so this waits for the panel to be open rather than
  // for a timeout to expire.
  await expect(trigger).toHaveAttribute("data-state", "open");

  // Scoped to the picker panel: the editor renders a card per existing element plus its settings, so
  // an unscoped non-exact name ("Date", "Rating") can match several buttons late in a build and fail
  // strict mode.
  const option = page
    .getByTestId("add-element-picker")
    .getByRole("button", { name: elementType, exact: options.exact ?? false });
  await expect(option).toBeVisible();
  // The picker is a two-column grid that overflows on shorter viewports (e.g. "Matrix").
  await option.scrollIntoViewIfNeeded();
  await option.click();

  // The picker closes itself from `handleAddElement`, so a collapsed trigger is the signal that
  // the element was committed to the survey and the new card is rendering.
  await expect(trigger).toHaveAttribute("data-state", "closed");
};

/**
 * The editor's live preview, which renders from the committed survey state.
 *
 * The label inputs keep their own local state, so an input can still show text that the survey no
 * longer holds — exactly what happens when a later edit overwrites an earlier one from a stale
 * array. Asserting against the preview is therefore the only reliable proof that an edit landed.
 */
const surveyPreview = (page: Page): Locator => page.locator("#survey-preview");

/**
 * Fill a list of label inputs until every value is present in the live preview at the same time.
 *
 * `updateChoice`/`updateMatrixLabel` rebuild their whole array from the props of the render they
 * were created in, so two quick edits overwrite each other — filling "Option 2" reverts "Option 1"
 * to "". Re-filling whatever the preview is still missing converges on the intended state without
 * pacing every action, which is what the spec-wide `slowMo: 150` used to do.
 */
const fillLabelsUntilCommitted = async (
  page: Page,
  values: string[],
  fieldFor: (index: number) => Locator
): Promise<void> => {
  const preview = surveyPreview(page);

  await expect(async () => {
    for (const [index, value] of values.entries()) {
      const field = fieldFor(index);
      if ((await field.inputValue()) !== value) {
        await expect(field).toBeEditable();
        await field.fill(value);
        await flushRender(page);
      }
    }

    for (const value of values) {
      await expect(preview.getByText(value, { exact: true }).first()).toBeVisible({ timeout: 2000 });
    }
  }).toPass({ timeout: 60000 });
};

/**
 * Click "Add row"/"Add column" until the matrix has `total` labels.
 *
 * One click per pass, each verified by the count growing by exactly one. Waiting for the *final*
 * count instead would burn the whole timeout on every intermediate pass, and could not keep its
 * promise not to overshoot: if a commit outlasted the wait, the next pass would still read the
 * pre-click count and click again, pushing the list past `total` with no way back.
 */
export const ensureMatrixLabelCount = async (page: Page, type: "row" | "column", total: number) => {
  const labels = page.locator(`input[id^="${type}-"]`);
  const addButton = page.getByRole("button", { name: type === "row" ? "Add row" : "Add column" });

  // One label per iteration, each add retried against its own target count. Driving the loop from
  // the outside is what keeps it honest: a `toPass` that merely "added one" reports success and
  // stops, and a `toPass` waiting for `total` burns its whole budget on every intermediate pass.
  for (let count = await labels.count(); count < total; count++) {
    const target = count + 1;

    await expect(async () => {
      if ((await labels.count()) < target) {
        await flushRender(page);
        await expect(addButton).toBeEnabled();
        await addButton.click();
      }
      await expect(labels).toHaveCount(target, { timeout: 2000 });
    }).toPass({ timeout: 20000 });
  }

  await expect(labels).toHaveCount(total);
};

/** Add every matrix label, then fill them — see fillLabelsUntilCommitted for the ordering reason. */
export const fillMatrixLabels = async (page: Page, type: "row" | "column", values: string[]) => {
  await ensureMatrixLabelCount(page, type, values.length);
  await fillLabelsUntilCommitted(page, values, (index) => page.locator(`#${type}-${index}`));
};

/**
 * Click until the choice list holds `total` inputs, one added per pass.
 *
 * Two different controls, because the forms disagree: the ranking form renders a single "Add option"
 * button (ranking-element-form.tsx), while the multiple-choice forms only offer the per-row
 * "Add choice below" icon (element-option-choice.tsx). Whichever exists is used, so this works for
 * select and ranking elements alike — with the select presets currently matching the fixtures, the
 * select path would otherwise only be exercised the day a fixture grew an option.
 */
export const ensureChoiceCount = async (page: Page, total: number) => {
  // Counting by placeholder, not by `id^="choice-"`: the "Other" and "None of the above" choices
  // share that id prefix, so an id-based count would never match the number of real options.
  const choices = page.locator('input[placeholder^="Option "]');
  const addOption = page.getByRole("button", { name: "Add option" });
  const addChoiceBelow = page.getByRole("button", { name: "Add choice below" });

  // One choice per iteration, each add retried against its own target count — see
  // ensureMatrixLabelCount for why the loop lives outside the retry.
  for (let count = await choices.count(); count < total; count++) {
    const target = count + 1;

    await expect(async () => {
      if ((await choices.count()) < target) {
        await flushRender(page);

        if (await addOption.count()) {
          await expect(addOption).toBeEnabled();
          await addOption.click();
        } else {
          const lastRowAdd = addChoiceBelow.last();
          await expect(lastRowAdd).toBeEnabled();
          await lastRowAdd.click();
        }
      }
      await expect(choices).toHaveCount(target, { timeout: 2000 });
    }).toPass({ timeout: 20000 });
  }

  await expect(choices).toHaveCount(total);
};

/** Add every choice, then fill them — see fillLabelsUntilCommitted for the ordering reason. */
export const fillChoiceOptions = async (page: Page, values: string[]) => {
  await ensureChoiceCount(page, values.length);
  await fillLabelsUntilCommitted(page, values, (index) => page.getByPlaceholder(`Option ${index + 1}`));
};

const publishButtonOf = (page: Page): Locator => page.getByRole("button", { name: "Publish", exact: true });

/**
 * Publish the survey being edited and wait for the summary page.
 *
 * The editor validates client-side and reports problems only through a toast that auto-dismisses, so
 * a failed publish otherwise surfaces as an opaque `waitForURL` timeout. This watches for the
 * navigation and collects error toasts alongside it, then fails with the message the editor actually
 * gave — or says plainly that none was shown, which points at a slow publish rather than a rejected
 * one.
 */
export const publishSurvey = async (page: Page): Promise<void> => {
  // Matches the per-test timeout in playwright.config.ts, and the `waitForURL` timeout every call
  // site used before this helper existed. Publishing the 13-element survey is the slowest step in
  // the suite; a shorter budget would turn a slow-but-passing run red.
  const publishTimeoutMs = 120000;
  const summaryUrl = /\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/;
  // Scoped to react-hot-toast's own error class (set in modules/ui/components/toaster-client) rather
  // than `role="status"`, which the shared `Alert` also uses — several of those are on screen in the
  // editor and would be reported as publish failures.
  const errorToasts = page.locator(".formbricks__toast__error");

  await expect(publishButtonOf(page)).toBeEnabled();
  await publishButtonOf(page).click();

  const navigated = page
    .waitForURL(summaryUrl, { timeout: publishTimeoutMs })
    .then(() => true)
    .catch(() => false);

  const seen = new Set<string>();

  for (;;) {
    // Racing the navigation keeps the toast reads off a destroyed execution context: once the
    // summary page starts loading, `navigated` wins and no further query is issued.
    const settled = await Promise.race([navigated, page.waitForTimeout(250).then(() => null)]);

    if (settled === true) return;
    if (settled === false) break;

    // The publish may still navigate between the race above and this read.
    for (const text of await errorToasts.allInnerTexts().catch(() => [])) {
      const message = text.trim();
      if (message) seen.add(message);
    }
  }

  const reported =
    seen.size > 0
      ? `Editor reported: ${JSON.stringify([...seen])}`
      : "No validation toast was shown, so this is a slow publish rather than a rejected one";

  throw new Error(
    `Publish did not reach the summary page within ${publishTimeoutMs}ms. ${reported} (url: ${page.url()})`
  );
};

export const createSurvey = async (page: Page, params: CreateSurveyParams) => {
  await createSurveyFromScratch(page);

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
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);

  await page.locator("h3").filter({ hasText: params.openTextQuestion.question }).click();

  // Single Select Question
  await addElement(page, "Single-Select");
  await fillRichTextEditor(page, "Question*", params.singleSelectQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.singleSelectQuestion.description);
  // "Other" is added before the labels are filled: the add rebuilds the choice array and would
  // otherwise wipe whatever had just been typed into Option 1/2.
  await addOtherChoice(page);
  await fillChoiceOptions(page, params.singleSelectQuestion.options);

  // Multi Select Question
  await addElement(page, "Multi-Select", { exact: true });
  await fillRichTextEditor(page, "Question*", params.multiSelectQuestion.question);
  await addDescription(page, { exact: true });
  await fillRichTextEditor(page, "Description", params.multiSelectQuestion.description);
  await fillChoiceOptions(page, params.multiSelectQuestion.options);

  // Rating Question
  await addElement(page, "Rating");
  await fillRichTextEditor(page, "Question*", params.ratingQuestion.question);
  await addDescription(page, { exact: true });
  await fillRichTextEditor(page, "Description", params.ratingQuestion.description);
  await page.getByPlaceholder("Not good").fill(params.ratingQuestion.lowLabel);
  await page.getByPlaceholder("Very satisfied").fill(params.ratingQuestion.highLabel);

  // NPS Question
  await addElement(page, "Net Promoter Score (NPS)");
  await fillRichTextEditor(page, "Question*", params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page.getByLabel("Upper label").fill(params.npsQuestion.highLabel);

  // CTA Question
  await addElement(page, "Statement (Call to Action)");
  await fillRichTextEditor(page, "Question*", params.ctaQuestion.question);

  // Enable external button and fill URL
  await page.locator("#buttonExternal").check();
  await page.getByRole("textbox", { name: "https://website.com" }).fill("https://example.com");
  await page.getByPlaceholder("Finish").fill(params.ctaQuestion.buttonLabel);

  // Consent Question
  await addElement(page, "Consent");
  await fillRichTextEditor(page, "Question*", params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // Picture Select Question
  await addElement(page, "Picture Selection");
  await fillRichTextEditor(page, "Question*", params.pictureSelectQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.pictureSelectQuestion.description);

  await uploadImageChoicesForPictureSelection(page);

  // File Upload Question
  await addElement(page, "File Upload");
  await fillRichTextEditor(page, "Question*", params.fileUploadQuestion.question);

  // Matrix Upload Question
  await addElement(page, "Matrix");
  await fillRichTextEditor(page, "Question*", params.matrix.question);
  await addDescription(page, { exact: true });
  await fillRichTextEditor(page, "Description", params.matrix.description);
  await fillMatrixLabels(page, "row", params.matrix.rows);
  await fillMatrixLabels(page, "column", params.matrix.columns);

  // Fill Address Question
  await addElement(page, "Address");
  await fillRichTextEditor(page, "Question*", params.address.question);
  await page.getByRole("row", { name: "Address Line 2" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "City" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "State" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Zip" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "Country" }).getByRole("switch").nth(1).click();

  // Fill Contact Info Question
  await addElement(page, "Contact Info");
  await fillRichTextEditor(page, "Question*", params.contactInfo.question);
  await page.getByRole("row", { name: "Last Name" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Email" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Phone" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Company" }).getByRole("switch").nth(1).click();

  // Fill Ranking question
  await addElement(page, "Ranking");
  await fillRichTextEditor(page, "Question*", params.ranking.question);
  await fillChoiceOptions(page, params.ranking.choices);
};

/**
 * A question's collapsed card heading inside the survey editor's element list.
 *
 * Scoped to the editor `<main>` on purpose. The editor renders a LIVE PREVIEW of the survey into
 * the same document (the `<aside>` holding `#survey-preview`, visible from the `md` breakpoint up),
 * and since ENG-2336 that preview exposes each element prompt as an `<h2>`. An unscoped
 * `getByRole("heading", { name })` would then match both the accordion heading and the preview's
 * prompt whenever the previewed card is the one being edited, failing Playwright's strict mode.
 */
const editorElementHeading = (page: Page, name: string): Locator =>
  page.getByRole("main").getByRole("heading", { name });

export const createSurveyWithLogic = async (page: Page, params: CreateSurveyWithLogicParams) => {
  await createSurveyFromScratch(page);

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
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.openTextQuestion.description);
  await page.getByLabel("Placeholder").fill(params.openTextQuestion.placeholder);

  await page.locator("h3").filter({ hasText: params.openTextQuestion.question }).click();

  // Single Select Question
  await addElement(page, "Single-Select");
  await fillRichTextEditor(page, "Question*", params.singleSelectQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.singleSelectQuestion.description);
  // "Other" is added before the labels are filled: the add rebuilds the choice array and would
  // otherwise wipe whatever had just been typed into Option 1/2.
  await addOtherChoice(page);
  await fillChoiceOptions(page, params.singleSelectQuestion.options);

  // Multi Select Question
  await addElement(page, "Multi-Select", { exact: true });
  await fillRichTextEditor(page, "Question*", params.multiSelectQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.multiSelectQuestion.description);
  await fillChoiceOptions(page, params.multiSelectQuestion.options);

  // Picture Select Question
  await addElement(page, "Picture Selection");
  await fillRichTextEditor(page, "Question*", params.pictureSelectQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.pictureSelectQuestion.description);
  await uploadImageChoicesForPictureSelection(page);

  // Rating Question
  await addElement(page, "Rating");
  await fillRichTextEditor(page, "Question*", params.ratingQuestion.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.ratingQuestion.description);
  await page.getByPlaceholder("Not good").fill(params.ratingQuestion.lowLabel);
  await page.getByPlaceholder("Very satisfied").fill(params.ratingQuestion.highLabel);

  // NPS Question
  await addElement(page, "Net Promoter Score (NPS)");
  await fillRichTextEditor(page, "Question*", params.npsQuestion.question);
  await page.getByLabel("Lower label").fill(params.npsQuestion.lowLabel);
  await page.getByLabel("Upper label").fill(params.npsQuestion.highLabel);

  // Fill Ranking question
  await addElement(page, "Ranking");
  await fillRichTextEditor(page, "Question*", params.ranking.question);
  await fillChoiceOptions(page, params.ranking.choices);

  // Matrix Question
  await addElement(page, "Matrix");
  await fillRichTextEditor(page, "Question*", params.matrix.question);
  await addDescription(page);
  await fillRichTextEditor(page, "Description", params.matrix.description);
  await fillMatrixLabels(page, "row", params.matrix.rows);
  await fillMatrixLabels(page, "column", params.matrix.columns);

  // CTA Question
  await addElement(page, "Statement (Call to Action)");
  await fillRichTextEditor(page, "Question*", params.ctaQuestion.question);

  // Enable external button and fill URL
  await page.locator("#buttonExternal").check();
  await page.getByRole("textbox", { name: "https://website.com" }).fill("https://example.com");
  await page.getByPlaceholder("Finish").fill(params.ctaQuestion.buttonLabel);

  // Consent Question
  await addElement(page, "Consent");
  await fillRichTextEditor(page, "Question*", params.consentQuestion.question);
  await page.getByPlaceholder("I agree to the terms and").fill(params.consentQuestion.checkboxLabel);

  // File Upload Question
  await addElement(page, "File Upload");
  await fillRichTextEditor(page, "Question*", params.fileUploadQuestion.question);

  // Date Question
  await addElement(page, "Date");
  await fillRichTextEditor(page, "Question*", params.date.question);

  // Cal Question
  await addElement(page, "Schedule a meeting");
  await fillRichTextEditor(page, "Question*", params.cal.question);

  // Fill Address Question
  await addElement(page, "Address");
  await fillRichTextEditor(page, "Question*", params.address.question);
  await page.getByRole("row", { name: "Address Line 2" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "City" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "State" }).getByRole("switch").nth(1).click();
  await page.getByRole("row", { name: "Zip" }).getByRole("cell").nth(2).click();
  await page.getByRole("row", { name: "Country" }).getByRole("switch").nth(1).click();

  // Adding logic to blocks
  // Block 1 (Open Text Question)
  await editorElementHeading(page, params.openTextQuestion.question).click();
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
  await editorElementHeading(page, params.singleSelectQuestion.question).click();
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
  await editorElementHeading(page, params.multiSelectQuestion.question).click();
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
  await editorElementHeading(page, params.pictureSelectQuestion.question).click();
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
  await editorElementHeading(page, params.ratingQuestion.question).click();
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
  await editorElementHeading(page, params.npsQuestion.question).click();
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
  await editorElementHeading(page, params.ranking.question).click();
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
  await editorElementHeading(page, params.matrix.question).click();
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
  await editorElementHeading(page, params.ctaQuestion.question).click();
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
  await editorElementHeading(page, params.consentQuestion.question).click();
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
  await editorElementHeading(page, params.fileUploadQuestion.question).click();
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
  await editorElementHeading(page, params.cal.question).click();
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
  await editorElementHeading(page, params.address.question).click();
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
