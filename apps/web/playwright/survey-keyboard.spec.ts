import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
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

interface SeededValidationSurvey {
  url: string;
  /** Element ids, so the spec can address each element's `${inputId}-error` region exactly. */
  ids: {
    openText: string;
    nps: string;
    ranking: string;
    date: string;
    pictureMulti: string;
  };
}

/**
 * Survey for the error-announcement contract.
 *
 * Auto-progress is OFF: a required auto-progress element (single-select, NPS,
 * rating, single picture-select) hides the submit button entirely, and without a
 * submit button there is no way to trigger an empty required submit at all.
 *
 * The four element types that newly carry `aria-invalid` on a GROUP node rather
 * than on a native control (NPS + ranking fieldsets, the date fieldset that
 * replaced `div role="group"`, and the picture-select multi fieldset) share one
 * card: a block holds many elements and validation runs over all of them, so a
 * single empty submit surfaces all four errors at once instead of needing a
 * four-card walk.
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
    select: { id: true },
  });

  return { url: `/s/${survey.id}`, ids };
};

/**
 * Resolves the focused control's aria-describedby IDREF list inside the page.
 *
 * Asserting the attribute alone would pass against a dangling reference — an id
 * that points at nothing announces nothing, and that is precisely the state this
 * change could regress into. So every referenced id is looked up and reported
 * with the text a screen reader would actually read from it.
 */
const focusedControlDescription = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const ids = (active.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    return {
      tagName: active.tagName,
      ariaInvalid: active.getAttribute("aria-invalid"),
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
  });

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

/** The announced state: the region carries the message and exactly one invalid control resolves to it. */
const expectAnnouncedError = async (page: Page, errorId: string): Promise<void> => {
  const region = errorRegion(page, errorId);
  await expect(region, `${errorId} should announce the required error`).toHaveText(REQUIRED_ERROR);
  // Polite on purpose: focus moves to the invalid control at the same instant, and
  // an assertive region (or role="alert") would interrupt that announcement.
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region, `${errorId} must not be an alert`).not.toHaveAttribute("role");

  const control = controlDescribedBy(page, errorId);
  await expect(control, `exactly one control should be described by ${errorId}`).toHaveCount(1);
  await expect(control).toHaveAttribute("aria-invalid", "true");
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

  test("no assertive live region spans the whole survey", async ({ page }) => {
    const { url, ids } = requireSeeded();

    await page.goto(url);
    await expect(page.locator("#fbjs")).toBeVisible();
    // Proves the scoped selector below can actually match live regions inside the
    // survey, so its zero-count assertion cannot pass vacuously.
    await expect(page.locator('#fbjs [aria-live="polite"]').first()).toBeAttached();

    // The wrapper used to be aria-live="assertive", so every DOM mutation anywhere
    // in the survey was announced assertively — which would talk over the polite
    // error region asserted above.
    await expect(page.locator('#fbjs [aria-live="assertive"]')).toHaveCount(0);

    await navButton(page, "Next").click();
    await expect(errorRegion(page, `${ids.openText}-input-error`)).toHaveText(REQUIRED_ERROR);
    await expect(page.locator('#fbjs [aria-live="assertive"]')).toHaveCount(0);
  });
});
