import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Keyboard interaction gate for the rendered link survey (ENG-1779).
 *
 * Covers the APG-aligned keyboard model of the survey player:
 * - radio-scale elements (single-select / NPS): one Tab stop, arrow keys move
 *   focus WITHOUT selecting, Space/Enter select — so auto-progress can never
 *   fire while a keyboard user is still browsing the options;
 * - select dropdowns: ArrowDown moves from the embedded search input into the
 *   options in both variants (previously a focus trap);
 * - focus management: the new card's first control is focused after navigation,
 *   and the first invalid control is focused after a failed submit.
 */

type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

const SINGLE_CHOICES = ["Free", "Pro", "Enterprise"];
const DROPDOWN_CHOICES = ["Berlin", "Paris", "Madrid", "Lisbon", "Vienna"];
const MULTI_CHOICES = ["Surveys", "Contacts", "Integrations", "Webhooks", "API"];
const ENDING_HEADLINE = "Thanks, keyboard friend!";

/** Auto-progress fires 350ms after an explicit selection; wait longer to prove a non-event. */
const AUTO_PROGRESS_SETTLE_MS = 900;

const buildQuestions = () => [
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: i18nValue("Which plan are you on?"),
    required: true,
    choices: SINGLE_CHOICES.map((label) => ({ id: createId(), label: i18nValue(label) })),
  },
  {
    id: createId(),
    type: "nps",
    headline: i18nValue("How likely are you to recommend us?"),
    required: true,
    lowerLabel: i18nValue("Not likely"),
    upperLabel: i18nValue("Very likely"),
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    displayType: "dropdown",
    headline: i18nValue("Which city do you work from?"),
    required: true,
    choices: DROPDOWN_CHOICES.map((label) => ({ id: createId(), label: i18nValue(label) })),
  },
  {
    id: createId(),
    type: "multipleChoiceMulti",
    displayType: "dropdown",
    headline: i18nValue("Which features do you use?"),
    required: true,
    choices: MULTI_CHOICES.map((label) => ({ id: createId(), label: i18nValue(label) })),
  },
  {
    id: createId(),
    type: "openText",
    headline: i18nValue("Anything else to add?"),
    required: true,
    inputType: "text",
    charLimit: { enabled: false },
  },
];

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const seedKeyboardSurvey = async (workspaceId: string, createdBy: string): Promise<string> => {
  const endings = [
    {
      id: createId(),
      type: "endScreen" as const,
      headline: i18nValue(ENDING_HEADLINE),
      subheader: i18nValue("We appreciate your feedback."),
    },
  ] as unknown as TSurveyEnding[];
  const blocks = transformQuestionsToBlocks(buildQuestions() as unknown as TLegacyQuestions, endings);

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Keyboard interaction survey",
      type: "link",
      status: "inProgress",
      isAutoProgressingEnabled: true,
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });
  return survey.id;
};

/**
 * Separate single-question survey for the picture-selection roving check (it
 * auto-progresses, so it gets its own fixture instead of a slot in the walk).
 * Public assets always resolve and satisfy ZStorageUrl (same trick as the axe
 * suite's picture card).
 */
const seedPictureSurvey = async (
  workspaceId: string,
  createdBy: string,
  baseURL: string
): Promise<string> => {
  const endings = [
    {
      id: createId(),
      type: "endScreen" as const,
      headline: i18nValue(ENDING_HEADLINE),
      subheader: i18nValue("We appreciate your feedback."),
    },
  ] as unknown as TSurveyEnding[];
  const questions = [
    {
      id: createId(),
      type: "pictureSelection",
      headline: i18nValue("Pick the image you prefer"),
      required: true,
      allowMulti: false,
      choices: [
        { id: createId(), imageUrl: new URL("/logo-transparent.png", baseURL).toString() },
        { id: createId(), imageUrl: new URL("/favicon/android-chrome-192x192.png", baseURL).toString() },
      ],
    },
  ];
  const blocks = transformQuestionsToBlocks(questions as unknown as TLegacyQuestions, endings);

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Keyboard picture-selection survey",
      type: "link",
      status: "inProgress",
      isAutoProgressingEnabled: true,
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });
  return survey.id;
};

// Off-screen stacked cards render a dummy copy of the nav button with tabindex="-1";
// only the current card's button is focusable.
const navButton = (page: Page, name: string) =>
  page.getByRole("button", { name }).and(page.locator('[tabindex="0"]'));

const activeRadio = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLInputElement | null;
    const isRadio = a?.tagName === "INPUT" && a.type === "radio";
    // Scope the checked lookup to the focused radio's own group: an off-screen
    // previous card may still hold its answered (checked) radio mid-transition.
    const checked = isRadio
      ? Array.from(document.getElementsByName(a.name)).find(
          (el): el is HTMLInputElement => el instanceof HTMLInputElement && el.checked
        )
      : undefined;
    return {
      isRadio,
      focusedValue: a?.value ?? null,
      checkedValue: checked?.value ?? null,
    };
  });

/**
 * Asserts a non-event: auto-progress must NOT fire while the user is only
 * browsing. The only way to prove nothing happens is to outwait the trigger
 * window (350ms submit delay plus margin) — there is no observable condition
 * to synchronize on, hence the deliberate fixed wait.
 */
const settleAutoProgressWindow = async (page: Page): Promise<void> => {
  await page.waitForTimeout(AUTO_PROGRESS_SETTLE_MS); // NOSONAR(typescript:S2925) -- asserting the absence of auto-progress requires outwaiting its window
};

test.describe("Survey keyboard interaction @slow", () => {
  // Seeded once and reused: the fixtures are per-test, so this is done lazily in
  // beforeEach (same pattern as survey-accessibility.spec.ts).
  let surveyUrl: string | undefined;
  let pictureSurveyUrl: string | undefined;

  test.beforeEach(async ({ users, baseURL }) => {
    if (surveyUrl) return;
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedKeyboardSurvey(user.workspaceId, user.id);
    const pictureSurveyId = await seedPictureSurvey(
      user.workspaceId,
      user.id,
      baseURL ?? "http://localhost:3000"
    );
    surveyUrl = `/s/${surveyId}`;
    pictureSurveyUrl = `/s/${pictureSurveyId}`;
  });

  test("arrows browse without selecting; Space selects and auto-progresses once", async ({ page }) => {
    await page.goto(surveyUrl ?? "");
    await expect(page.getByText("Which plan are you on?")).toBeVisible();

    // The first control of the card is focused on a link survey.
    await expect.poll(async () => (await activeRadio(page)).isRadio, { timeout: 5000 }).toBe(true);

    // Browsing with arrows moves focus but selects nothing and never advances.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await settleAutoProgressWindow(page);
    const browsed = await activeRadio(page);
    expect(browsed.checkedValue).toBeNull();
    await expect(page.getByText("Which plan are you on?")).toBeVisible();

    // Space selects the focused option, auto-progress advances exactly one card,
    // and focus lands on the new card's first control (an NPS radio).
    await page.keyboard.press("Space");
    await expect(page.getByText("How likely are you to recommend us?")).toBeVisible();
    await expect.poll(async () => (await activeRadio(page)).isRadio, { timeout: 5000 }).toBe(true);

    // Same guarantees on the NPS scale, selecting with Enter this time.
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await settleAutoProgressWindow(page);
    expect((await activeRadio(page)).checkedValue).toBeNull();
    await expect(page.getByText("How likely are you to recommend us?")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByText("Which city do you work from?")).toBeVisible();
  });

  const answerFirstTwoCards = async (page: Page): Promise<void> => {
    await page.goto(surveyUrl ?? "");
    await expect(page.getByText("Which plan are you on?")).toBeVisible();
    await page.getByText(SINGLE_CHOICES[0], { exact: true }).click();
    await expect(page.getByText("How likely are you to recommend us?")).toBeVisible();
    // The radio is sr-only; click its visible label cell.
    await page.locator("label", { has: page.locator('input[aria-label="Rate 9 out of 10"]') }).click();
    await expect(page.getByText("Which city do you work from?")).toBeVisible();
  };

  test("dropdown search is keyboard-escapable into the options in both variants", async ({ page }) => {
    await answerFirstTwoCards(page);

    // Single-select dropdown: the trigger is the card's first control.
    await expect
      .poll(async () => page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup")))
      .toBe("menu");
    await page.keyboard.press("Enter");
    const search = page.getByRole("textbox", { name: "Search..." });
    await expect(search).toBeFocused();

    // ArrowDown leaves the search and highlights options; Enter selects, the
    // dropdown commits on close and auto-progress advances.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: DROPDOWN_CHOICES[1] })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Which features do you use?")).toBeVisible();

    // Multi-select dropdown: same path in, Space toggles and keeps the menu open,
    // ArrowUp from the first option returns to the search input.
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Search..." })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(page.getByRole("menuitemcheckbox", { name: MULTI_CHOICES[0] })).toHaveAttribute(
      "data-state",
      "checked"
    );
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("textbox", { name: "Search..." })).toBeFocused();
    await page.keyboard.press("Escape");

    await navButton(page, "Next").click();
    await expect(page.getByText("Anything else to add?")).toBeVisible();
  });

  test("failed submit focuses the first invalid control", async ({ page }) => {
    await answerFirstTwoCards(page);

    // Answer the two dropdown cards with the pointer to reach the open-text card.
    await page.getByRole("button", { name: /Which city do you work from/ }).click();
    await page.getByRole("menuitemradio", { name: DROPDOWN_CHOICES[0] }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Which features do you use?")).toBeVisible();
    await page.getByRole("button", { name: /Which features do you use/ }).click();
    await page.getByRole("menuitemcheckbox", { name: MULTI_CHOICES[0] }).click();
    await page.keyboard.press("Escape");
    await navButton(page, "Next").click();
    await expect(page.getByText("Anything else to add?")).toBeVisible();

    // Empty required submit: stay on the card and focus the invalid input.
    await navButton(page, "Finish").click();
    await expect(page.getByText("Anything else to add?")).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const a = document.activeElement;
          return a?.tagName === "INPUT" || a?.tagName === "TEXTAREA";
        })
      )
      .toBe(true);

    // Fixing the answer completes the survey.
    await page.keyboard.type("All good!");
    await navButton(page, "Finish").click();
    await expect(page.getByText(ENDING_HEADLINE)).toBeVisible();
  });

  test("picture selection: arrows browse without selecting; Space selects and auto-progresses", async ({
    page,
  }) => {
    await page.goto(pictureSurveyUrl ?? "");
    await expect(page.getByText("Pick the image you prefer")).toBeVisible();

    // First picture radio is focused on a link survey.
    await expect.poll(async () => (await activeRadio(page)).isRadio, { timeout: 5000 }).toBe(true);

    // Arrow browsing selects nothing and never advances.
    await page.keyboard.press("ArrowRight");
    await settleAutoProgressWindow(page);
    expect((await activeRadio(page)).checkedValue).toBeNull();
    await expect(page.getByText("Pick the image you prefer")).toBeVisible();

    // Space selects the focused picture and auto-progress completes the survey.
    await page.keyboard.press("Space");
    await expect(page.getByText(ENDING_HEADLINE)).toBeVisible();
  });
});
