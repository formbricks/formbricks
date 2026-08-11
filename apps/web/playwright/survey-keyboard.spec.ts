import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Keyboard / assistive-technology gate for the rendered link survey.
 *
 * Covers the APG-aligned keyboard model of the survey player (ENG-1779):
 * - radio-scale elements (single-select / NPS): one Tab stop, arrow keys move
 *   focus WITHOUT selecting, Space/Enter select — so auto-progress can never
 *   fire while a keyboard user is still browsing the options;
 * - select dropdowns: ArrowDown moves from the embedded search input into the
 *   options in both variants (previously a focus trap);
 * - focus management: the new card's first control is focused after navigation,
 *   and the first invalid control is focused after a failed submit.
 *
 * …and the announcement half of that same failed submit (ENG-1292): the error a
 * sighted user sees must reach a screen-reader user too. axe cannot catch this —
 * a static scan has no way to know that a message which appears after an event
 * was never announced — so these assertions ARE the regression guard.
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

/* -------------------------------------------------------------------------- *
 * ENG-1292 — validation errors must be announced, not just painted.
 * -------------------------------------------------------------------------- */

/** The required-field message every element type renders (surveys locale `errors.please_fill_out_this_field`). */
const REQUIRED_ERROR = "Please fill out this field";
const OPEN_TEXT_HEADLINE = "What went wrong?";
const GROUPED_HEADLINE = "How likely are you to recommend us?";
const CONTACT_HEADLINE = "How can we contact you?";

interface SeededValidationSurvey {
  url: string;
  modalSurvey: TJsWorkspaceStateSurvey;
  /** Element ids, so the spec can address each element's `${inputId}-error` region exactly. */
  ids: {
    openText: string;
    nps: string;
    ranking: string;
    date: string;
    pictureMulti: string;
    consent: string;
    fileUpload: string;
    matrix: string;
    contactInfo: string;
  };
}

/**
 * Survey for the error-announcement contract.
 *
 * Auto-progress is OFF: a required auto-progress element (single-select, NPS,
 * rating, single picture-select) hides the submit button entirely, and without a
 * submit button there is no way to trigger an empty required submit at all.
 *
 * The element types that need an announcement regression guard share one card:
 * a block holds many elements and validation runs over all of them, so a single
 * empty submit surfaces every error at once instead of needing a card per type.
 */
const seedValidationSurvey = async (
  workspaceId: string,
  createdBy: string,
  baseURL: string
): Promise<SeededValidationSurvey> => {
  const ids = {
    openText: createId(),
    nps: createId(),
    ranking: createId(),
    date: createId(),
    pictureMulti: createId(),
    consent: createId(),
    fileUpload: createId(),
    matrix: createId(),
    contactInfo: createId(),
  };

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
      id: ids.openText,
      type: "openText",
      headline: i18nValue(OPEN_TEXT_HEADLINE),
      // A subheader gives the input a second aria-describedby token, so the spec
      // proves the error id is APPENDED to an existing description rather than
      // replacing it.
      subheader: i18nValue("Tell us as much as you like."),
      required: true,
      inputType: "text",
      charLimit: { enabled: false },
    },
    {
      id: ids.nps,
      type: "nps",
      headline: i18nValue(GROUPED_HEADLINE),
      required: true,
      lowerLabel: i18nValue("Not likely"),
      upperLabel: i18nValue("Very likely"),
    },
    {
      id: ids.ranking,
      type: "ranking",
      headline: i18nValue("Rank these in order of importance"),
      required: true,
      choices: ["Speed", "Reliability", "Support"].map((label) => ({
        id: createId(),
        label: i18nValue(label),
      })),
    },
    {
      id: ids.date,
      type: "date",
      headline: i18nValue("When did it happen?"),
      required: true,
      format: "M-d-y",
    },
    {
      id: ids.pictureMulti,
      type: "pictureSelection",
      headline: i18nValue("Pick the screenshots that match"),
      required: true,
      // allowMulti renders the <fieldset> branch; the single branch is a role="radiogroup".
      allowMulti: true,
      choices: [
        { id: createId(), imageUrl: new URL("/logo-transparent.png", baseURL).toString() },
        { id: createId(), imageUrl: new URL("/favicon/android-chrome-192x192.png", baseURL).toString() },
      ],
    },
    {
      id: ids.consent,
      type: "consent",
      headline: i18nValue("Do you agree to participate?"),
      label: i18nValue("I agree"),
      required: true,
    },
    {
      id: ids.fileUpload,
      type: "fileUpload",
      headline: i18nValue("Upload supporting evidence"),
      required: true,
      allowMultipleFiles: false,
    },
    {
      id: ids.matrix,
      type: "matrix",
      headline: i18nValue("Rate each part of the experience"),
      required: true,
      shuffleOption: "none",
      rows: ["Setup", "Support"].map((label) => ({ id: createId(), label: i18nValue(label) })),
      columns: ["Poor", "Good"].map((label) => ({ id: createId(), label: i18nValue(label) })),
    },
    {
      id: ids.contactInfo,
      type: "contactInfo",
      headline: i18nValue(CONTACT_HEADLINE),
      required: true,
      firstName: { show: true, required: false, placeholder: i18nValue("First name") },
      lastName: { show: false, required: false, placeholder: i18nValue("Last name") },
      email: { show: true, required: true, placeholder: i18nValue("Email") },
      phone: { show: false, required: false, placeholder: i18nValue("Phone") },
      company: { show: false, required: false, placeholder: i18nValue("Company") },
    },
  ];

  // transformQuestionsToBlocks emits one block per question; merge the grouped
  // types into a single second block so they render on one card.
  const perQuestionBlocks = transformQuestionsToBlocks(questions as unknown as TLegacyQuestions, endings);
  const [openTextBlock, ...groupedBlocks] = perQuestionBlocks;
  const blocks = [
    openTextBlock,
    { ...groupedBlocks[0], elements: groupedBlocks.flatMap((block) => block.elements) },
  ];

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Validation announcement survey",
      type: "link",
      status: "inProgress",
      // See the docblock: auto-progress would hide the submit button on the
      // required NPS element and make an empty submit unreachable.
      isAutoProgressingEnabled: false,
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
  });

  const modalSurvey = {
    ...survey,
    displayPercentage: null,
    languages: [],
    triggers: [],
    segment: null,
    followUps: [],
  } as unknown as TJsWorkspaceStateSurvey;

  return { url: `/s/${survey.id}`, ids, modalSurvey };
};

/**
 * Resolves a control's aria-describedby IDREF list against the document.
 *
 * Asserting the attribute alone would pass against a dangling reference — an id
 * that points at nothing announces nothing, and that is precisely the state this
 * change could regress into. So every referenced id is looked up and reported
 * with the text a screen reader would actually read from it.
 *
 * Runs INSIDE the page (Playwright serializes it), so it must stay closure-free.
 */
const readDescription = (control: Element | null) => {
  if (!control) return null;
  const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return {
    tagName: control.tagName,
    ariaInvalid: control.getAttribute("aria-invalid"),
    ids,
    resolved: ids.map((id) => {
      const target = document.getElementById(id);
      return {
        id,
        exists: target !== null,
        text: target?.textContent?.trim() ?? null,
        ariaLive: target?.getAttribute("aria-live") ?? null,
        role: target?.getAttribute("role") ?? null,
      };
    }),
  };
};

/** …for whatever currently holds focus. */
const focusedControlDescription = async (page: Page) => {
  const active = await page.evaluateHandle(() => document.activeElement);
  try {
    return await page.evaluate(readDescription, active);
  } finally {
    await active.dispose();
  }
};

/** …for one named control, so an assertion can target a box that is not focused. */
const describedControl = (control: Locator) => control.evaluate(readDescription);

/** The live region for an element, addressed by the `${inputId}-error` call-site convention. */
const errorRegion = (page: Page, errorId: string) => page.locator(`[id="${errorId}"]`);

/** Whatever node currently declares itself described by that region (CSS `~=` matches one IDREF token). */
const controlDescribedBy = (page: Page, errorId: string) => page.locator(`[aria-describedby~="${errorId}"]`);

/** A region that exists, is polite, and is silent: the state a live region must be in BEFORE the error. */
const expectSilentLiveRegion = async (page: Page, errorId: string): Promise<void> => {
  const region = errorRegion(page, errorId);
  await expect(region, `${errorId} should already be in the DOM before any submit`).toHaveCount(1);
  await expect(region, `${errorId} should render nothing while there is no error`).toBeEmpty();
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region).toHaveAttribute("aria-atomic", "true");
  await expect(controlDescribedBy(page, errorId), `nothing should point at ${errorId} yet`).toHaveCount(0);
};

/**
 * The announced state: the region carries the message and every control that
 * resolves to it is flagged invalid.
 *
 * `describedControls` is the exact number of nodes allowed to point at the region.
 * It is 1 for element types with a single invalid node, and 2 for the select types,
 * where the group (or dropdown trigger) AND the "Other" free-text box each need
 * their own description — see the "Other" suite below for why the ancestor's is not
 * enough.
 */
const expectAnnouncedError = async (page: Page, errorId: string, describedControls = 1): Promise<void> => {
  const region = errorRegion(page, errorId);
  await expect(region, `${errorId} should announce the required error`).toHaveText(REQUIRED_ERROR);
  // Polite on purpose: focus moves to the invalid control at the same instant, and
  // an assertive region (or role="alert") would interrupt that announcement.
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region, `${errorId} must not be an alert`).not.toHaveAttribute("role");

  const control = controlDescribedBy(page, errorId);
  await expect(
    control,
    `exactly ${String(describedControls)} control(s) should be described by ${errorId}`
  ).toHaveCount(describedControls);
  for (let index = 0; index < describedControls; index++) {
    await expect(control.nth(index)).toHaveAttribute("aria-invalid", "true");
  }
};

test.describe("Survey validation error announcement @slow", () => {
  // Seeded once per worker process and reused: the tests only read the published
  // survey (responses never mutate it), same rationale as the suites above.
  let seeded: SeededValidationSurvey | undefined;

  const requireSeeded = (): SeededValidationSurvey => {
    if (!seeded) throw new Error("validation survey was not seeded");
    return seeded;
  };

  test.beforeEach(async ({ users, baseURL }) => {
    if (seeded) return;
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    seeded = await seedValidationSurvey(user.workspaceId, user.id, baseURL ?? "http://localhost:3000");
  });

  test("empty required submit announces the error through a live region that already existed", async ({
    page,
  }) => {
    const { url, ids } = requireSeeded();
    const errorId = `${ids.openText}-input-error`;
    const input = page.locator(`[id="${ids.openText}-input"]`);

    await page.goto(url);
    await expect(page.getByText(OPEN_TEXT_HEADLINE)).toBeVisible();
    await expect(input).toBeVisible();

    // AC2 — the region must pre-exist. A live region inserted together with its
    // message is not reliably announced, so mounting it only on error would look
    // correct on screen and stay silent in a screen reader.
    await expectSilentLiveRegion(page, errorId);

    await navButton(page, "Next").click();

    // Still on the card, and the SAME node now carries the message: updated, not remounted.
    await expect(page.getByText(OPEN_TEXT_HEADLINE)).toBeVisible();
    await expectAnnouncedError(page, errorId);
    await expect(errorRegion(page, errorId)).toBeVisible();

    // The failed control is flagged invalid and keeps its pre-existing description
    // token (the subheader) alongside the error one.
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", new RegExp(`(^|\\s)${errorId}(\\s|$)`));
    await expect(input).toHaveAttribute(
      "aria-describedby",
      new RegExp(`(^|\\s)${ids.openText}-input-description(\\s|$)`)
    );

    // The core proof: focus is on the invalid control and its aria-describedby
    // RESOLVES to a node whose text is the visible error message.
    await expect
      .poll(async () => (await focusedControlDescription(page))?.ariaInvalid, { timeout: 5000 })
      .toBe("true");
    const described = await focusedControlDescription(page);
    expect(described?.ids, "the focused control should point at its error region").toContain(errorId);
    expect(
      described?.resolved.every((target) => target.exists),
      `aria-describedby contains a dangling IDREF: ${JSON.stringify(described?.resolved)}`
    ).toBe(true);
    expect(
      described?.resolved.map((target) => target.text),
      "the described node must read out the visible error message"
    ).toContain(REQUIRED_ERROR);
    expect(described?.resolved.find((target) => target.id === errorId)?.ariaLive).toBe("polite");
    await expect(page.getByText(REQUIRED_ERROR)).toBeVisible();

    // Answering clears the announcement and the association, but keeps the region
    // mounted and ready for the next failure.
    await input.fill("The Next button did nothing at all");
    await expect(errorRegion(page, errorId)).toBeEmpty();
    await expect(errorRegion(page, errorId)).toHaveCount(1);
    await expect(input).not.toHaveAttribute("aria-invalid", "true");
    await expect(controlDescribedBy(page, errorId)).toHaveCount(0);
  });

  test("group-level element types announce through a resolvable region too", async ({ page }) => {
    const { url, ids } = requireSeeded();
    const groupedIds = [ids.nps, ids.ranking, ids.date, ids.pictureMulti];

    await page.goto(url);
    await expect(page.getByText(OPEN_TEXT_HEADLINE)).toBeVisible();
    await page.locator(`[id="${ids.openText}-input"]`).fill("Something broke on submit");
    await navButton(page, "Next").click();
    await expect(page.getByText(GROUPED_HEADLINE)).toBeVisible();

    for (const id of groupedIds) {
      await expectSilentLiveRegion(page, `${id}-error`);
    }

    await navButton(page, "Finish").click();

    for (const id of groupedIds) {
      await expectAnnouncedError(page, `${id}-error`);
    }

    // These four flag the invalid state on a grouping element rather than a native
    // control; date specifically moved from `div role="group"` to a real fieldset.
    for (const id of groupedIds) {
      await expect(
        page.locator(`fieldset[aria-describedby="${id}-error"]`),
        `${id} should expose its invalid state on a native fieldset`
      ).toHaveCount(1);
    }
  });

  test("remaining error-capable element types keep their announcement wiring", async ({ page }) => {
    const { url, ids } = requireSeeded();

    await page.goto(url);
    await page.locator(`[id="${ids.openText}-input"]`).fill("Something broke on submit");
    await navButton(page, "Next").click();
    await expect(page.getByText(GROUPED_HEADLINE)).toBeVisible();

    const consentErrorId = `${ids.consent}-error`;
    const fileUploadErrorId = `${ids.fileUpload}-error`;
    const matrixErrorId = `${ids.matrix}-error`;
    const contactErrorId = `${ids.contactInfo}-error`;
    for (const errorId of [consentErrorId, fileUploadErrorId, matrixErrorId, contactErrorId]) {
      await expectSilentLiveRegion(page, errorId);
    }

    await navButton(page, "Finish").click();

    await expectAnnouncedError(page, consentErrorId);
    await expect(
      page.getByRole("checkbox", { name: "I agree" }),
      "the consent checkbox should expose the invalid state and its error description"
    ).toHaveAttribute("aria-describedby", consentErrorId);

    await expectAnnouncedError(page, fileUploadErrorId);
    await expect(page.locator(`input[type="file"][aria-describedby="${fileUploadErrorId}"]`)).toHaveCount(1);

    await expectAnnouncedError(page, matrixErrorId);
    await expect(page.locator(`fieldset[aria-describedby="${matrixErrorId}"]`)).toHaveCount(1);

    // Contact and address elements share one message across several inputs. The
    // live region must announce it, but no individual field may inherit a
    // description that could belong to one of its siblings.
    const contactRegion = errorRegion(page, contactErrorId);
    await expect(contactRegion).toHaveText(REQUIRED_ERROR);
    await expect(contactRegion).toHaveAttribute("aria-live", "polite");
    await expect(contactRegion).not.toHaveAttribute("role");
    await expect(controlDescribedBy(page, contactErrorId)).toHaveCount(0);

    const firstName = page.getByRole("textbox", { name: "First name" });
    await expect(firstName).toHaveAttribute("aria-invalid", "true");
    await expect(firstName).not.toHaveAttribute("aria-describedby");
  });

  test("no assertive live region spans the modal survey", async ({ page }) => {
    const { url, modalSurvey } = requireSeeded();

    // Load the production survey bundle through the link page, then render the
    // same fixture through its modal entry point. The removed assertive wrapper
    // exists only in this branch of SurveyContainer.
    await page.goto(url);
    await expect(page.locator("#fbjs")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(window.formbricksSurveys))).toBe(true);
    await page.evaluate((survey) => {
      document.getElementById("formbricks-survey-container")?.replaceChildren();
      window.formbricksSurveys.renderSurvey({
        survey,
        styling: {},
        isBrandingEnabled: false,
        languageCode: "default",
        mode: "modal",
        isPreviewMode: true,
      });
    }, modalSurvey);

    const modalRoot = page.locator("#formbricks-modal-container #fbjs");
    await expect(modalRoot.getByRole("dialog")).toBeVisible();
    // Proves the scoped selector can match a live region inside the modal, so the
    // zero-count assertion cannot pass on an empty or incorrectly rendered path.
    await expect(modalRoot.locator('[aria-live="polite"]').first()).toBeAttached();
    await expect(modalRoot.locator('[aria-live="assertive"]')).toHaveCount(0);
    await expect(modalRoot.locator(":scope > div")).toHaveAttribute("aria-live", "polite");
  });
});

/* -------------------------------------------------------------------------- *
 * ENG-1292 — the "Other" free-text box must describe its OWN error.
 * -------------------------------------------------------------------------- */

/**
 * The "Other" box is the one control whose invalid state has no other route to a
 * screen reader. Its enclosing fieldset (list variant) or its dropdown trigger
 * does carry aria-describedby, but per accname an ancestor's description is NOT
 * part of a descendant's accessible description — so focusing the box announced
 * "invalid" with no reason at all, while a sighted user saw the message right
 * above it.
 *
 * Both select types ship their own copy of that input in both display variants,
 * so all four are seeded onto ONE card: block validation runs over every element,
 * and a single empty submit surfaces all four errors instead of a four-card walk.
 */
interface OtherVariant {
  /** Also the suffix that makes every accessible name in the fixture unique. */
  key: string;
  type: "multipleChoiceSingle" | "multipleChoiceMulti";
  displayType: "list" | "dropdown";
  headline: string;
  choices: [string, string];
}

/** Two regular choices + "Other" stays at the dropdown search threshold, so no search box renders. */
const OTHER_VARIANTS: OtherVariant[] = [
  // First on purpose: a failed submit focuses the first invalid control inside the
  // FIRST erroring element's form, and here that control is the "Other" box itself
  // — focusFirstControl matches `:is(input, textarea, select)[aria-invalid="true"]`,
  // which skips the dropdown trigger because the trigger is a <button>.
  {
    key: "single-dropdown",
    type: "multipleChoiceSingle",
    displayType: "dropdown",
    headline: "Which plan are you on",
    choices: ["Free", "Pro"],
  },
  {
    key: "single-list",
    type: "multipleChoiceSingle",
    displayType: "list",
    headline: "Which city do you work from",
    choices: ["Berlin", "Paris"],
  },
  {
    key: "multi-dropdown",
    type: "multipleChoiceMulti",
    displayType: "dropdown",
    headline: "Which features do you use",
    choices: ["Surveys", "Contacts"],
  },
  {
    key: "multi-list",
    type: "multipleChoiceMulti",
    displayType: "list",
    headline: "Which channels do you send from",
    choices: ["Email", "Link"],
  },
];

const otherLabel = (variant: OtherVariant): string => `Other ${variant.key}`;
const otherPlaceholder = (variant: OtherVariant): string => `Specify ${variant.key}`;
const isMultiSelect = (variant: OtherVariant): boolean => variant.type === "multipleChoiceMulti";

interface SeededOtherSurvey {
  url: string;
  /** Element id per variant key, so the spec can address each `${elementId}-error` region. */
  elementIds: Record<string, string>;
}

const seedOtherSurvey = async (workspaceId: string, createdBy: string): Promise<SeededOtherSurvey> => {
  const elementIds: Record<string, string> = {};

  const endings = [
    {
      id: createId(),
      type: "endScreen" as const,
      headline: i18nValue(ENDING_HEADLINE),
      subheader: i18nValue("We appreciate your feedback."),
    },
  ] as unknown as TSurveyEnding[];

  const questions = OTHER_VARIANTS.map((variant) => {
    const id = createId();
    elementIds[variant.key] = id;
    return {
      id,
      type: variant.type,
      displayType: variant.displayType,
      headline: i18nValue(variant.headline),
      required: true,
      choices: [
        ...variant.choices.map((label) => ({ id: createId(), label: i18nValue(label) })),
        // The renderer keys the free-text option off the literal choice id "other".
        { id: "other", label: i18nValue(otherLabel(variant)) },
      ],
      otherOptionPlaceholder: i18nValue(otherPlaceholder(variant)),
    };
  });

  // transformQuestionsToBlocks emits one block per question; merge them into a
  // single card so one empty submit exercises all four "Other" boxes at once.
  const perQuestionBlocks = transformQuestionsToBlocks(questions as unknown as TLegacyQuestions, endings);
  const blocks = [
    { ...perQuestionBlocks[0], elements: perQuestionBlocks.flatMap((block) => block.elements) },
  ];

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Other option announcement survey",
      type: "link",
      status: "inProgress",
      // Off for the same reason as the validation fixture: a required auto-progress
      // element hides the submit button, and without one there is no empty submit to
      // make. A multi-element block already disables auto-progress; the flag keeps
      // the fixture honest if it is ever split into one card per variant.
      isAutoProgressingEnabled: false,
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });

  return { url: `/s/${survey.id}`, elementIds };
};

/**
 * The "Other" free-text box. The list variant names it with aria-label (the option
 * label); the dropdown variant carries no label at all, so its accessible name
 * falls back to the placeholder.
 */
const otherBox = (page: Page, variant: OtherVariant): Locator =>
  page.getByRole("textbox", {
    name: variant.displayType === "list" ? otherLabel(variant) : otherPlaceholder(variant),
    exact: true,
  });

/** Selects "Other" for one variant and resolves once its free-text box is on screen. */
const selectOther = async (page: Page, variant: OtherVariant): Promise<Locator> => {
  const name = otherLabel(variant);

  if (variant.displayType === "dropdown") {
    await page.getByRole("button", { name: variant.headline }).click();
    await page.getByRole(isMultiSelect(variant) ? "menuitemcheckbox" : "menuitemradio", { name }).click();
    // A checkbox item keeps the menu open by design; a radio item closes it, and the
    // single-select dropdown only commits its value on close.
    if (isMultiSelect(variant)) await page.keyboard.press("Escape");
  } else {
    // The native control is sr-only; click the visible row that labels it.
    await page
      .locator("label")
      .filter({ has: page.getByRole(isMultiSelect(variant) ? "checkbox" : "radio", { name, exact: true }) })
      .click();
  }

  const box = otherBox(page, variant);
  await expect(box, `${variant.key}: selecting "Other" should reveal its free-text box`).toBeVisible();
  return box;
};

/** The regression guard: this box, on its own, announces why it is invalid. */
const expectOtherBoxDescribesError = async (box: Locator, errorId: string, key: string): Promise<void> => {
  await expect(box, `${key}: the "Other" box should be flagged invalid`).toHaveAttribute(
    "aria-invalid",
    "true"
  );

  // Resolving the IDREF list is the whole point: a dangling id, or one pointing at
  // an empty node, renders exactly like a correct one but announces nothing.
  const described = await describedControl(box);
  expect(described?.ids, `${key}: the box should point at ${errorId}`).toContain(errorId);
  expect(
    described?.resolved.every((target) => target.exists),
    `${key}: aria-describedby contains a dangling IDREF: ${JSON.stringify(described?.resolved)}`
  ).toBe(true);
  expect(
    described?.resolved.map((target) => target.text),
    `${key}: the described node must read out the visible error message`
  ).toContain(REQUIRED_ERROR);
  expect(described?.resolved.find((target) => target.id === errorId)?.ariaLive).toBe("polite");
};

test.describe('Survey "Other" option error announcement @slow', () => {
  // Seeded once per worker process and reused: the test only reads the published
  // survey, same rationale as the suites above.
  let seeded: SeededOtherSurvey | undefined;

  const requireSeeded = (): SeededOtherSurvey => {
    if (!seeded) throw new Error("other-option survey was not seeded");
    return seeded;
  };

  test.beforeEach(async ({ users }) => {
    if (seeded) return;
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    seeded = await seedOtherSurvey(user.workspaceId, user.id);
  });

  test('an empty "Other" box announces its own error in both select types and variants', async ({ page }) => {
    const { url, elementIds } = requireSeeded();
    const errorIdFor = (variant: OtherVariant): string => `${elementIds[variant.key]}-error`;

    await page.goto(url);
    await expect(page.getByText(OTHER_VARIANTS[0].headline)).toBeVisible();

    // Every region is mounted and silent before anything is submitted.
    for (const variant of OTHER_VARIANTS) {
      await expectSilentLiveRegion(page, errorIdFor(variant));
    }

    // Select "Other" everywhere and leave every box empty — the exact state that
    // used to render aria-invalid with no aria-describedby at all.
    const boxes: Record<string, Locator> = {};
    for (const variant of OTHER_VARIANTS) {
      boxes[variant.key] = await selectOther(page, variant);
    }

    await navButton(page, "Finish").click();
    await expect(page.getByText(OTHER_VARIANTS[0].headline)).toBeVisible();

    for (const variant of OTHER_VARIANTS) {
      const errorId = errorIdFor(variant);
      // Two nodes describe the region: the group (list) or the trigger (dropdown),
      // AND the "Other" box itself — the second one is the fix.
      await expectAnnouncedError(page, errorId, 2);
      await expectOtherBoxDescribesError(boxes[variant.key], errorId, variant.key);
      await expect(errorRegion(page, errorId)).toBeVisible();
    }

    // focusFirstControl prefers an invalid native control inside the first erroring
    // element's form, so the box that has to be fixed is the one that gets focus —
    // and what it announces on arrival is the assertion above.
    await expect(boxes[OTHER_VARIANTS[0].key]).toBeFocused();
    expect((await focusedControlDescription(page))?.ids).toContain(errorIdFor(OTHER_VARIANTS[0]));

    // Typing clears the announcement and the association on the SAME node, so
    // nothing is left pointing at an empty region, and the answers are accepted.
    for (const variant of OTHER_VARIANTS) {
      await boxes[variant.key].fill(`Something else for ${variant.key}`);
    }
    for (const variant of OTHER_VARIANTS) {
      const errorId = errorIdFor(variant);
      await expect(errorRegion(page, errorId)).toBeEmpty();
      await expect(errorRegion(page, errorId)).toHaveCount(1);
      await expect(controlDescribedBy(page, errorId)).toHaveCount(0);
    }

    await navButton(page, "Finish").click();
    await expect(page.getByText(ENDING_HEADLINE)).toBeVisible();
  });
});
