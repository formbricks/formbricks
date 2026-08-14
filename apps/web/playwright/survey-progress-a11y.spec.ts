import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Progress semantics of the rendered link survey (ENG-1070).
 *
 * The survey progress bar used to be a plain `<div>`: visible on screen, absent
 * from the accessibility tree. It now declares `role="progressbar"` with an
 * accessible name and a determinate 0..100 value.
 *
 * The guarantee worth a test is not that the attributes exist, but that
 * `aria-valuenow` can never drift from what is painted: one clamped, floored
 * expression drives both the indicator's inline width and the exposed value. A
 * refactor that splits them (floor one, round the other) is exactly the silent
 * regression this spec catches — a screen reader announcing 17% over a 16% bar
 * looks fine in every screenshot.
 *
 * Covered here:
 * - determinate semantics + name on the default (stacked) link-survey layout,
 * - value == painted width on every card of a full walk, forwards and backwards,
 * - 0 on the welcome card, 100 on the ending card, strictly increasing between,
 * - the cardless layout, which renders the same bar from a different call site
 *   and deliberately omits it on the welcome card,
 * - `hideProgressBar` styling: no phantom progressbar left in the a11y tree.
 *
 * Tagged @slow — it provisions three surveys and walks two of them end to end.
 * The tag is metadata only; the spec still runs in the standard `pnpm test:e2e`
 * job (testMatch **\/*.spec.ts).
 */

type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

/** en-US value of `common.survey_progress` (packages/surveys/locales/en-US.json). */
const PROGRESS_LABEL = "Survey progress";
const ENDING_HEADLINE = "Thanks for walking the bar!";

/**
 * Five question blocks plus one ending = six cards, so the reported percentages are
 * 16/33/50/66/83/100. Four of the six truncate, which is precisely where a width
 * computed one way and an aria value computed another would start to disagree.
 */
const QUESTION_HEADLINES = [
  "What brought you here today?",
  "How did you hear about us?",
  "What are you trying to achieve?",
  "What nearly stopped you?",
  "Anything else on your mind?",
];

/** Number of advance clicks from the welcome card to the ending card. */
const WALK_STEPS = QUESTION_HEADLINES.length + 1;

const CARD_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 8_000;

const buildQuestions = () =>
  QUESTION_HEADLINES.map((headline) => ({
    id: createId(),
    type: "openText",
    headline: i18nValue(headline),
    // Optional so the walk is a pure navigation flow: the progress value must
    // depend on the card position, never on whether an answer was given.
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
  }));

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

interface SeedOptions {
  name: string;
  /** Defaults to a link survey; "app" is only used for the auto-close countdown. */
  type?: "link" | "app";
  styling?: Record<string, unknown>;
  welcomeCardEnabled?: boolean;
  autoCloseSeconds?: number;
}

/**
 * Seeds a published multi-card survey straight through Prisma — the same boundary
 * the `users` fixture writes through, so no login or dashboard step is needed for
 * the link-survey cases. The legacy `questions` shape is converted with the SAME
 * `transformQuestionsToBlocks` the v1 management API uses server-side, so the stored
 * blocks cannot drift from the API contract. Created as `inProgress` because
 * `/s/<id>` 404s for drafts.
 */
const seedProgressSurvey = async (
  workspaceId: string,
  createdBy: string,
  options: SeedOptions
): Promise<string> => {
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
      name: options.name,
      type: options.type ?? "link",
      status: "inProgress",
      welcomeCard: {
        enabled: options.welcomeCardEnabled ?? true,
        headline: i18nValue("Welcome"),
        timeToFinish: false,
        showResponseCount: false,
      } as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
      ...(options.styling ? { styling: options.styling as Prisma.InputJsonValue } : {}),
      ...(options.autoCloseSeconds ? { autoClose: options.autoCloseSeconds } : {}),
    },
    select: { id: true },
  });
  return survey.id;
};

/**
 * Off-screen stacked cards render a dummy copy of the nav buttons with
 * `tabindex="-1"`; only the current card's buttons are focusable. Same locator
 * shape as survey-keyboard.spec.ts.
 */
const navButton = (page: Page, name: string | RegExp): Locator =>
  page.getByRole("button", { name }).and(page.locator('[tabindex="0"]'));

const advanceButton = (page: Page): Locator => navButton(page, /^(Next|Finish)$/);

interface BarSnapshot {
  valueNow: number | null;
  valueMin: string | null;
  valueMax: string | null;
  indicatorWidth: string | null;
}

/**
 * Reads every rendered progress bar in ONE evaluate, so the exposed value and the
 * painted width are always sampled from the same render. Reading them with two
 * round-trips could straddle a re-render and either hide a real mismatch or invent
 * one.
 *
 * Normally exactly one bar is rendered: the "straight" arrangement keeps four
 * stacked cards mounted, but only the current one gets real content (the peeking
 * cards render a dummy body, see wrappers/stacked-card.tsx). The helper still reads
 * all of them and requires agreement, because the swap between outgoing and incoming
 * card is staggered by 300ms and could briefly mount two — and two bars disagreeing
 * would itself be a defect worth failing on.
 */
const readBars = (page: Page): Promise<BarSnapshot[]> =>
  page.locator('[role="progressbar"]').evaluateAll((elements) =>
    elements.map((element) => {
      const valueNow = element.getAttribute("aria-valuenow");
      const indicator = element.firstElementChild as HTMLElement | null;
      return {
        valueNow: valueNow === null ? null : Number(valueNow),
        valueMin: element.getAttribute("aria-valuemin"),
        valueMax: element.getAttribute("aria-valuemax"),
        indicatorWidth: indicator ? indicator.style.width : null,
      };
    })
  );

/** Pure: the single value every rendered bar agrees on, or null while they disagree / none exist. */
const agreedValue = (bars: BarSnapshot[]): number | null => {
  if (bars.length === 0) return null;
  const values = new Set(bars.map((bar) => bar.valueNow));
  if (values.size !== 1) return null;
  const [value] = [...values];
  return value;
};

/**
 * Polls until every rendered bar reports the same value AND that value satisfies
 * `matches`, then returns the snapshot that satisfied it. Polling on the progress
 * value itself is the synchronization point: card headlines are unusable for this
 * because the peeking cards render the next card's headline before it is current.
 */
const settledBars = async (
  page: Page,
  matches: (value: number) => boolean,
  message: string
): Promise<BarSnapshot[]> => {
  let captured: BarSnapshot[] = [];
  await expect
    .poll(
      async () => {
        captured = await readBars(page);
        const value = agreedValue(captured);
        return value !== null && matches(value);
      },
      { message, timeout: CARD_TIMEOUT, intervals: [100] }
    )
    .toBe(true);
  return captured;
};

/**
 * Asserts the determinate contract on every rendered bar and returns the value they
 * agree on: a 0..100 range, a numeric current value inside it, and — the point of
 * the change — a painted width that is exactly that value.
 */
const assertDeterminate = (bars: BarSnapshot[], context: string): number => {
  expect(bars.length, `${context}: at least one progress bar should be rendered`).toBeGreaterThan(0);

  for (const bar of bars) {
    expect(bar.valueMin, `${context}: aria-valuemin`).toBe("0");
    expect(bar.valueMax, `${context}: aria-valuemax`).toBe("100");
    expect(bar.valueNow, `${context}: aria-valuenow should be numeric`).not.toBeNull();
    const value = bar.valueNow as number;
    expect(value, `${context}: aria-valuenow should be within the declared range`).toBeGreaterThanOrEqual(0);
    expect(value, `${context}: aria-valuenow should be within the declared range`).toBeLessThanOrEqual(100);
    expect(
      bar.indicatorWidth,
      `${context}: the painted indicator width must equal aria-valuenow (${value.toString()})`
    ).toBe(`${value.toString()}%`);
  }

  const value = agreedValue(bars);
  expect(value, `${context}: all rendered progress bars must report the same progress`).not.toBeNull();
  return value as number;
};

/**
 * Clicks through `steps` cards, asserting after each one that the reported progress
 * strictly increased and still matches the painted width. Returns the value observed
 * after every step.
 */
const walkForward = async (page: Page, steps: number, startValue: number): Promise<number[]> => {
  const observed: number[] = [];
  let previous = startValue;

  for (let step = 1; step <= steps; step++) {
    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    const bars = await settledBars(
      page,
      (value) => value > previous,
      `progress should advance past ${previous.toString()}% on step ${step.toString()}`
    );
    previous = assertDeterminate(bars, `step ${step.toString()}`);
    observed.push(previous);
  }

  return observed;
};

test.describe("Survey progress accessibility @slow", () => {
  // Seeded once per worker and reused: the tests only read the published surveys,
  // and responses never mutate them, so re-seeding per test would buy no isolation.
  // Same lazy-beforeEach pattern as survey-accessibility.spec.ts / survey-keyboard.spec.ts.
  let stackedUrl: string | undefined;
  let cardlessUrl: string | undefined;
  let hiddenBarUrl: string | undefined;

  test.beforeEach(async ({ users }) => {
    if (stackedUrl) return;
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");

    const [stackedId, cardlessId, hiddenBarId] = await Promise.all([
      seedProgressSurvey(user.workspaceId, user.id, { name: "Progress semantics (stacked)" }),
      seedProgressSurvey(user.workspaceId, user.id, {
        name: "Progress semantics (cardless)",
        styling: {
          overwriteThemeStyling: true,
          cardArrangement: { linkSurveys: "cardless", appSurveys: "straight" },
        },
      }),
      seedProgressSurvey(user.workspaceId, user.id, {
        name: "Progress semantics (bar hidden)",
        styling: { overwriteThemeStyling: true, hideProgressBar: true },
      }),
    ]);

    stackedUrl = `/s/${stackedId}`;
    cardlessUrl = `/s/${cardlessId}`;
    hiddenBarUrl = `/s/${hiddenBarId}`;
  });

  test("progress advances with determinate semantics that match the painted width", async ({ page }) => {
    await page.goto(stackedUrl ?? "");

    // The bar reaches assistive tech by role AND name, not just as raw attributes.
    const namedBars = page.getByRole("progressbar", { name: PROGRESS_LABEL });
    await expect(namedBars.first(), "progress bar should expose its accessible name").toBeVisible({
      timeout: CARD_TIMEOUT,
    });

    // Welcome card: no progress made yet.
    const welcomeBars = await settledBars(page, (value) => value === 0, "welcome card should report 0%");
    expect(assertDeterminate(welcomeBars, "welcome card")).toBe(0);
    expect(await namedBars.count(), "every rendered progress bar should carry the accessible name").toBe(
      welcomeBars.length
    );

    // Walk to the ending card; each step must move the value up and keep it pinned
    // to the painted width.
    const observed = await walkForward(page, WALK_STEPS, 0);

    await expect(page.getByText(ENDING_HEADLINE), "walk should reach the ending card").toBeVisible({
      timeout: CARD_TIMEOUT,
    });
    expect(observed.at(-1), "the ending card should report a complete survey").toBe(100);
  });

  test("back navigation moves the reported progress back down", async ({ page }) => {
    await page.goto(stackedUrl ?? "");
    await settledBars(page, (value) => value === 0, "welcome card should report 0%");

    // Forward twice so Back lands on a card that still has progress to report.
    const [firstValue, secondValue] = await walkForward(page, 2, 0);
    expect(secondValue, "second card should report more progress than the first").toBeGreaterThan(firstValue);

    await navButton(page, "Back").click({ timeout: ACTION_TIMEOUT });
    const bars = await settledBars(
      page,
      (value) => value < secondValue,
      "going back should reduce the reported progress"
    );
    expect(assertDeterminate(bars, "after back navigation")).toBe(firstValue);
  });

  test("cardless layout exposes the same determinate semantics", async ({ page }) => {
    await page.goto(cardlessUrl ?? "");
    await expect(advanceButton(page), "cardless survey should render").toBeVisible({ timeout: CARD_TIMEOUT });

    // The cardless layout deliberately hides the bar on the welcome card — so it must
    // be absent from the accessibility tree there, not present and reporting 0.
    await expect(
      page.getByRole("progressbar"),
      "cardless welcome card should expose no progress bar"
    ).toHaveCount(0);

    // From the first question onwards the single bar behaves exactly like the stacked one.
    const observed = await walkForward(page, WALK_STEPS, -1);
    await expect(
      page.getByRole("progressbar", { name: PROGRESS_LABEL }),
      "cardless layout should render exactly one named progress bar"
    ).toHaveCount(1);

    await expect(page.getByText(ENDING_HEADLINE), "walk should reach the ending card").toBeVisible({
      timeout: CARD_TIMEOUT,
    });
    expect(observed.at(-1), "the ending card should report a complete survey").toBe(100);
  });

  test("hiding the progress bar leaves nothing behind in the accessibility tree", async ({ page }) => {
    await page.goto(hiddenBarUrl ?? "");
    await expect(advanceButton(page), "survey should render with the bar hidden").toBeVisible({
      timeout: CARD_TIMEOUT,
    });

    await expect(page.getByRole("progressbar"), "a hidden progress bar must not be announced").toHaveCount(0);

    // Still true after navigating — the role is not attached late by a different path.
    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    await expect(page.getByText(QUESTION_HEADLINES[0]).first()).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  });
});

/**
 * The auto-close countdown only renders for `type: "app"` surveys with `autoClose`
 * set, and `/s/<id>` 404s for anything that is not a link survey — so it is
 * unreachable from the link-survey fixtures above. The editor's live preview renders
 * the very same `AutoCloseProgressBar` through `SurveyInline`, which makes it the
 * cheapest surface that exercises this component: seed + login + one navigation, no
 * js-core widget harness.
 *
 * What this does NOT cover: the countdown as delivered by the js-core widget in a
 * host page (js.spec.ts territory). The component and its ARIA output are identical;
 * only the embedding differs.
 */
const COUNTDOWN_LABEL = "Time remaining before the survey closes";
const AUTO_CLOSE_SECONDS = 30;
/** en-US resolution of `common.survey_closes_automatically_in_x_seconds` (plural branch). */
const COUNTDOWN_ANNOUNCEMENT = `This survey closes automatically in ${AUTO_CLOSE_SECONDS.toString()} seconds unless you respond`;
/** The editor route is heavier than a link survey; a cold dev server compiles it on first hit. */
const EDITOR_TIMEOUT = 60_000;

test.describe("App survey auto-close countdown accessibility @slow", () => {
  let editorUrl: string | undefined;

  // Seeded per test rather than per worker: each test gets its own browser context,
  // so the login the editor route needs has to happen inside the test's own context.
  test.beforeEach(async ({ users }) => {
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedProgressSurvey(user.workspaceId, user.id, {
      name: "Auto-close countdown semantics",
      type: "app",
      // No welcome card, so the countdown shows on the first question card — the
      // wrapper only renders it while `isFirstQuestion && !hasInteracted`.
      welcomeCardEnabled: false,
      autoCloseSeconds: AUTO_CLOSE_SECONDS,
    });
    editorUrl = `/workspaces/${user.workspaceId}/surveys/${surveyId}/edit`;
    await user.login();
  });

  test("countdown is an indeterminate progressbar with a polite one-shot announcement", async ({ page }) => {
    await page.addInitScript(() => {
      const announcementStates: string[] = [];
      const observedRegions = new WeakSet<Element>();
      const selector = '.sr-only[aria-live="polite"][aria-atomic="true"]';

      (window as typeof window & { __countdownAnnouncementStates?: string[] }).__countdownAnnouncementStates =
        announcementStates;

      const observeRegion = (region: Element) => {
        if (
          observedRegions.has(region) ||
          !region.parentElement?.querySelector(
            '[role="progressbar"][aria-label="Time remaining before the survey closes"]'
          )
        ) {
          return;
        }

        observedRegions.add(region);
        announcementStates.push(region.textContent ?? "");
        new MutationObserver(() => announcementStates.push(region.textContent ?? "")).observe(region, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      };

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const addedNode of mutation.addedNodes) {
            if (!(addedNode instanceof Element)) continue;
            if (addedNode.matches(selector)) observeRegion(addedNode);
            addedNode.querySelectorAll(selector).forEach(observeRegion);
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });

    await page.goto(editorUrl ?? "");
    const preview = page.locator("#formbricks-survey-container");
    await expect(preview, "editor preview should render the app survey").toBeVisible({
      timeout: EDITOR_TIMEOUT,
    });

    // Two progress bars share the screen here; a screen reader user can only tell
    // them apart by their accessible names, so both must be uniquely named.
    const countdown = preview.getByRole("progressbar", { name: COUNTDOWN_LABEL });
    await expect(countdown, "countdown should be exposed as a named progressbar").toHaveCount(1);
    await expect(
      preview.getByRole("progressbar", { name: PROGRESS_LABEL }),
      "the survey progress bar should remain separately named"
    ).toHaveCount(1);

    // Indeterminate by design: the bar is CSS-animated, so there is no value to keep
    // in sync and ARIA says to omit `aria-valuenow` rather than declare a lie. This
    // is exactly the attribute a well-meaning refactor would "restore".
    await expect(
      countdown,
      "an indeterminate progressbar must not declare aria-valuenow"
    ).not.toHaveAttribute("aria-valuenow");

    // The shrinking bar is visual only; the deadline is stated once, politely.
    const announcement = preview.getByText(COUNTDOWN_ANNOUNCEMENT, { exact: true });
    await expect(announcement, "the countdown should be announced once").toHaveCount(1);
    await expect(announcement).toHaveAttribute("aria-live", "polite");
    await expect(announcement).toHaveAttribute("aria-atomic", "true");

    const announcementStates = await page.evaluate(
      () =>
        (window as typeof window & { __countdownAnnouncementStates?: string[] })
          .__countdownAnnouncementStates ?? []
    );
    expect(announcementStates[0], "the live region should mount empty").toBe("");
    expect(announcementStates.at(-1), "the live region should be populated after mounting").toBe(
      COUNTDOWN_ANNOUNCEMENT
    );
  });

  test("countdown and its announcement leave the accessibility tree once the user interacts", async ({
    page,
  }) => {
    await page.goto(editorUrl ?? "");
    const preview = page.locator("#formbricks-survey-container");
    await expect(preview).toBeVisible({ timeout: EDITOR_TIMEOUT });
    await expect(preview.getByRole("progressbar", { name: COUNTDOWN_LABEL })).toHaveCount(1);

    // Answering cancels the countdown, so the "closes in 30 seconds" statement must
    // not be left behind for assistive tech to read as still true.
    await preview.getByRole("textbox").first().click({ timeout: ACTION_TIMEOUT });

    await expect(
      preview.getByRole("progressbar", { name: COUNTDOWN_LABEL }),
      "a cancelled countdown must not stay in the accessibility tree"
    ).toHaveCount(0);
    await expect(
      preview.getByText(COUNTDOWN_ANNOUNCEMENT, { exact: true }),
      "a cancelled countdown must not leave a stale announcement"
    ).toHaveCount(0);
    await expect(
      preview.getByRole("progressbar", { name: PROGRESS_LABEL }),
      "the survey progress bar is unaffected by the countdown"
    ).toHaveCount(1);
  });
});
