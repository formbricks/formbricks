import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page, expect } from "@playwright/test";
import { logger } from "@formbricks/logger";
import { test } from "./lib/fixtures";
import {
  A11Y_ANSWERED_STATES_SURVEY_NAME,
  A11Y_SURVEY_NAME,
  CAL_EMBED_ORIGIN,
  CAL_HEADLINE,
  CTA_EXTERNAL_BUTTON_LABEL,
  CTA_EXTERNAL_HEADLINE,
  DATE_HEADLINE,
  ENDING_CARD_HEADLINE,
  FILE_UPLOAD_HEADLINE,
  OPEN_TEXT_HEADLINE,
  SINGLE_SELECT_HEADLINE,
  type SeededAccessibilitySurveys,
  WELCOME_CARD_HEADLINE,
  seedAccessibilitySurveys,
} from "./utils/accessibility";
import { mockStorageUploads } from "./utils/helper";

/**
 * Accessibility gate for the rendered link survey (axe-core).
 *
 * Self-seeds + publishes a kitchen-sink survey, then walks every question card in
 * nine variants (desktop / mobile / tablet, forced-colors, reduced-motion, dark,
 * empty-submit, back-nav, and a multi-language RTL pass) and asserts zero WCAG 2.1
 * / 2.2 AA violations. A silent stall fails the test rather than passing as "clean":
 * the walker proves it advanced and reached the ending card.
 *
 * A tenth variant scans the second, "answered states" fixture (ENG-1298): the cards
 * whose DOM only exists after an interaction, which the walker — which scans each card
 * once, before answering it — structurally cannot reach, plus the Cal.com scheduler
 * wrapper, which cannot live in the kitchen sink at all.
 *
 * Tagged @slow — it provisions surveys and walks them across many variants. It runs
 * in the standard `pnpm test:e2e` job (testMatch **\/*.spec.ts); the tag is metadata
 * only and does not exclude it from discovery.
 */

// Only WCAG 2.1 / 2.2 A + AA conformance tags fail the build. These are the levels
// we commit to for the survey surface. Each spec version's A and AA tags are listed
// separately because axe tags rules with exactly one of them (e.g. `wcag22a` rules
// are NOT also tagged `wcag22aa`).
const FAIL_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

// Everything else axe can emit is informational here: opinionated best-practice
// rules, experimental checks, and other standards (ACT, US Section 508, EN 301 549)
// that overlap with — but are not — our WCAG 2.1/2.2 AA commitment. We still RUN
// them and log any findings as warnings so regressions are visible, but they do not
// fail the build.
const WARN_TAGS = ["best-practice", "experimental", "ACT", "section508", "EN-301-549"];

/**
 * Documented allowlist — the ONLY violations we knowingly tolerate. Each entry is a
 * specific, justified, third-party or known-issue item; keep this minimal. Anything
 * not listed here that violates a FAIL_TAG rule is a real regression and fails the
 * build. A finding is suppressed only when its rule id matches AND at least one
 * failing-node target matches one of the `targets` substrings, so the allowlist
 * cannot accidentally hide unrelated violations of the same rule.
 */
interface AllowlistEntry {
  ruleId: string;
  targets: string[];
  justification: string;
}

// Currently empty: every violation the suite found was fixed at the source instead
// (file-upload dropzone restructure, branding contrast), and the Cal.com third-party
// iframe needs no entry because it never renders — the answered-states walk blocks the
// embed origin and asserts the container stayed empty, so only our own wrapper is
// graded. Add entries only for justified wontfixes.
const ALLOWLIST: AllowlistEntry[] = [];

type ViolationRow = {
  variant: string;
  card: string;
  id: string;
  impact: string;
  help: string;
  target: string;
  helpUrl: string;
};

const CARD_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 8_000;
const MAX_STEPS = 25;

// The file the answered-states walk attaches to the (required) file-upload card. Built in
// memory rather than read from disk so the spec owns its own fixture, and kept to an SVG the
// storage mock already serves for unknown names (see `mockStorageUploads`). The stem is
// asserted against the delete control's accessible name, which the app derives from the stored
// file name — so it must survive the upload round-trip.
const UPLOAD_FIXTURE_STEM = "a11y-answered-states";
const UPLOAD_FIXTURE_FILE_NAME = `${UPLOAD_FIXTURE_STEM}.svg`;
const UPLOAD_FIXTURE_BODY = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#0f172a"/></svg>',
  "utf8"
);

const isAllowlisted = (ruleId: string, target: string): boolean =>
  ALLOWLIST.some(
    (entry) =>
      entry.ruleId === ruleId &&
      entry.targets.some((needle) => target.toLowerCase().includes(needle.toLowerCase()))
  );

/**
 * Runs axe ONCE against the current page state over the union of fail + warn tags,
 * then partitions each violation by whether it carries a WCAG AA (FAIL_TAGS) tag.
 * AA violations are collected into `failSink` (minus allowlisted nodes); everything
 * else is logged as a warning only. A single `analyze()` is used because axe shares
 * one instance per page and cannot run concurrently.
 */
const scan = async (page: Page, variant: string, card: string, failSink: ViolationRow[]): Promise<void> => {
  const results = await new AxeBuilder({ page }).withTags([...FAIL_TAGS, ...WARN_TAGS]).analyze();

  for (const v of results.violations) {
    const isFailTag = v.tags.some((tag) => FAIL_TAGS.includes(tag));

    if (!isFailTag) {
      logger.warn(
        `[a11y warn][${variant}][${card}] ${v.id} (${v.impact ?? "n/a"}) — ${v.help} · ${v.nodes.length} node(s) · ${v.helpUrl}`
      );
      continue;
    }

    for (const node of v.nodes) {
      const target = node.target.join(" ");
      if (isAllowlisted(v.id, target)) {
        logger.warn(`[a11y allowlisted][${variant}][${card}] ${v.id} — ${target}`);
        continue;
      }
      failSink.push({
        variant,
        card,
        id: v.id,
        impact: v.impact ?? "unknown",
        help: v.help,
        target,
        helpUrl: v.helpUrl,
      });
    }
  }
};

/**
 * Selects a radio/checkbox control regardless of how it is implemented. All survey
 * choice controls render a native, visually-hidden (sr-only) `<input>` wrapped in a
 * visible `<label>`; the input itself never passes Playwright's actionability checks,
 * so we click the wrapping label — the same thing a real pointer user does. Non-input
 * role="radio"/"checkbox" elements (if any) are clicked directly.
 */
const selectControl = async (control: Locator): Promise<void> => {
  if ((await control.count()) === 0) return;
  const tagName = await control.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
  if (tagName === "input") {
    const label = control.locator("xpath=ancestor::label[1]");
    if ((await label.count()) > 0) {
      await label.click({ timeout: ACTION_TIMEOUT }).catch(() => undefined);
    }
  } else {
    await control.click({ timeout: ACTION_TIMEOUT }).catch(() => undefined);
  }
};

/**
 * Answers every answerable control on the current card so the walker can advance.
 * Single-select, multi-select, rating and matrix all render native, visually-hidden
 * inputs wrapped in visible labels (one radio group per matrix ROW, keyed by the
 * input `name`); ranking is a set of "Add … to ranking" buttons. File upload is an
 * optional card we intentionally skip answering but still advance past.
 */
const answerCurrentCard = async (page: Page, card: Locator): Promise<void> => {
  // Text-like inputs (open text, "other" fields). Skip file inputs.
  const textInputs = card.locator(
    'input:not([type="hidden"]):not([type="file"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]), textarea'
  );
  const textCount = await textInputs.count();
  for (let i = 0; i < textCount; i++) {
    const input = textInputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;
    if (await input.inputValue().catch(() => "")) continue;
    const type = (await input.getAttribute("type")) ?? "text";
    const value = type === "email" ? "test@example.com" : type === "number" ? "5" : "Test answer";
    await input.fill(value, { timeout: ACTION_TIMEOUT });
  }

  // All choice questions render native radios grouped by their `name` attribute:
  // single-select and rating are one group per card, and the matrix is one group per
  // ROW (with no radiogroup role on the row). Answering the first radio of every
  // distinct name therefore satisfies each matrix row as well as the simple groups.
  const nativeRadios = card.locator('input[type="radio"]');
  const radioNames: string[] = await nativeRadios.evaluateAll((els) => [
    ...new Set(els.map((el) => (el as HTMLInputElement).name)),
  ]);
  for (const name of radioNames) {
    await selectControl(card.locator(`input[type="radio"][name="${name}"]`).first());
  }
  if (radioNames.length === 0) {
    // Fallback for any non-native role="radio" implementation.
    await selectControl(card.getByRole("radio").first());
  }

  // Multi-select / consent expose role="checkbox".
  const checkboxes = card.getByRole("checkbox");
  const checkboxCount = await checkboxes.count();
  for (let i = 0; i < checkboxCount; i++) {
    await selectControl(checkboxes.nth(i));
  }

  // Ranking: click each "Add … to ranking" button in order.
  const rankingButtons = card.getByRole("button", { name: /^Add .+ to ranking$/ });
  const rankCount = await rankingButtons.count();
  for (let i = 0; i < rankCount; i++) {
    // The list re-renders as items move into the ranked column, so re-query the
    // first remaining "Add" button each iteration.
    const next = card.getByRole("button", { name: /^Add .+ to ranking$/ }).first();
    if ((await next.count()) === 0) break;
    await next.click({ timeout: ACTION_TIMEOUT });
  }

  // Picture selection: choices render as clickable images inside the card.
  const pictureChoice = card
    .locator('label:has(img), [role="button"]:has(img)')
    .filter({ hasNot: card.locator('[aria-label*="Powered"]') })
    .first();
  if (await pictureChoice.isVisible().catch(() => false)) {
    await pictureChoice.click({ timeout: ACTION_TIMEOUT }).catch(() => undefined);
  }

  // Date picker: the calendar renders inline (no trigger to open). Click an enabled
  // day cell button directly. Skip the first/last grid buttons to avoid out-of-month
  // padding days, then fall back to any enabled day if needed.
  const dayCells = card.getByRole("gridcell").locator("button:not([disabled])");
  const dayCount = await dayCells.count();
  if (dayCount > 0) {
    const preferredIndex = dayCount > 10 ? 10 : 0;
    const target = dayCells.nth(preferredIndex);
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: ACTION_TIMEOUT }).catch(() => undefined);
    }
  }
};

// Survey link surveys default to the "straight" card arrangement, which renders the
// active card plus up to three peeking cards sharing the same `questionCard-<idx>`
// id pattern. Peeking / transitioning cards still contain a nav button, but only the
// CURRENT card's nav button is focusable (`tabindex` 0); off-screen cards render it
// with `tabindex="-1"`. We therefore target the focusable nav button to find the
// active card, which avoids matching a peeking card such as `questionCard--1`.
//
// The Submit/Next/Finish button always carries the `border-submit-button-border`
// class (primary variant in packages/surveys), so we match on that instead of the
// button label — the label is localized (e.g. Arabic "التالي" in the RTL variant)
// and a text match would silently fail to find the button there.
const ADVANCE_BUTTON_SELECTOR = 'button.border-submit-button-border:not([tabindex="-1"])';

const advanceButtonOnPage = (page: Page): Locator => page.locator(ADVANCE_BUTTON_SELECTOR);

const activeCard = (page: Page): Locator =>
  page.locator('[id^="questionCard-"]').filter({ has: advanceButtonOnPage(page) });

const getActiveCardId = async (page: Page): Promise<string | null> => {
  const card = activeCard(page).first();
  if ((await card.count()) === 0) return null;
  if (!(await card.isVisible().catch(() => false))) return null;
  return card.getAttribute("id");
};

const advanceButton = (card: Locator): Locator => card.locator(ADVANCE_BUTTON_SELECTOR);

// The ending card renders its (fixture-controlled) headline as an <h2>; that is a stable
// positive signal that the survey completed (unlike "no nav button", which is also briefly
// true during the 600ms card transition animation). Every card headline is an h2 — the survey
// name is the page's only h1 (ENG-2336) — so the ending is matched by its exact headline text.
// Endings are not language-patched, so this holds in the RTL variant too.
const endingCardLocator = (page: Page): Locator =>
  page.getByRole("heading", { level: 2, name: ENDING_CARD_HEADLINE });

const isOnEndingCard = (page: Page): Promise<boolean> =>
  endingCardLocator(page)
    .first()
    .isVisible()
    .catch(() => false);

/**
 * Waits until the card and all its ancestors are fully opaque. The renderer fades
 * cards in with `transition-opacity duration-500`; scanning mid-fade makes axe blend
 * the semi-transparent text into the background and report contrast failures that do
 * not exist in the settled UI (observed as flaky `color-contrast` findings).
 */
const waitForSettled = async (page: Page, selector: string): Promise<void> => {
  await page
    .waitForFunction(
      (sel) => {
        let el: HTMLElement | null = document.querySelector(sel);
        if (!el) return false;
        while (el) {
          if (getComputedStyle(el).opacity !== "1") return false;
          el = el.parentElement;
        }
        return true;
      },
      selector,
      { timeout: 5000 }
    )
    .catch(() => undefined);
};

const waitForCardSettled = (page: Page, cardId: string): Promise<void> =>
  waitForSettled(page, `[id="${cardId}"]`);

/**
 * Locator-based twin of `waitForSettled`, for elements that cannot be named by a stable CSS
 * selector. The ending card is matched by role + heading text because peeking cards carry
 * identical markup, so `document.querySelector` would settle on the wrong one.
 */
const waitForLocatorSettled = async (locator: Locator): Promise<void> => {
  await expect
    .poll(
      () =>
        locator
          .evaluate((node: HTMLElement) => {
            let el: HTMLElement | null = node;
            while (el) {
              if (getComputedStyle(el).opacity !== "1") return false;
              el = el.parentElement;
            }
            return true;
          })
          .catch(() => false),
      { timeout: 5000, intervals: [100] }
    )
    .toBe(true)
    // Mirrors waitForSettled: a timeout is not an error here, the caller's assertions decide.
    .catch(() => undefined);
};

/**
 * After clicking advance, wait for a STABLE next state: either a different active card
 * id confirmed on two consecutive polls (so we don't latch onto the mid-animation gap
 * where no nav button is focusable), or the ending card. Returns the new active card
 * id, or null when the ending card is reached.
 */
const waitForCardTransition = async (page: Page, fromCardId: string): Promise<string | null> => {
  let stableId: string | null = null;
  let stableHits = 0;
  let outcome: string | null | undefined;

  await expect
    .poll(
      async () => {
        if (await isOnEndingCard(page)) {
          outcome = null;
          return true;
        }
        const currentId = await getActiveCardId(page);
        if (currentId && currentId !== fromCardId) {
          if (currentId === stableId) {
            stableHits += 1;
          } else {
            stableId = currentId;
            stableHits = 1;
          }
          if (stableHits >= 2) {
            outcome = currentId;
            return true;
          }
        }
        return false;
      },
      { timeout: CARD_TIMEOUT, intervals: [150] }
    )
    .toBe(true)
    // Timeout is not an error here: mirror the previous behavior of falling back to
    // whatever card is currently active so the caller's stall detection decides.
    .catch(() => undefined);

  if (outcome !== undefined) return outcome;
  return getActiveCardId(page);
};

/**
 * Walks the survey from the welcome card to the ending card, scanning each step.
 * Asserts forward progress: if the same card id is seen on three consecutive steps
 * we treat it as a stall and FAIL (a stall must never be reported as "clean"). At
 * the end it asserts the ending card is reached, proving the walk completed.
 */
const walkAndScan = async (
  page: Page,
  variant: string,
  surveyUrl: string,
  failSink: ViolationRow[]
): Promise<void> => {
  await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });

  // The welcome card is itself the active card "questionCard--1" (welcome maps to
  // block index -1 in the renderer) with a focusable nav button, so the single walk
  // loop below handles it exactly like a question card — no separate welcome click,
  // which previously raced against the peeking-card "Next" buttons. We just wait for
  // the first active card (welcome or, if disabled, the first question) to render.
  await expect(activeCard(page).first(), "survey first card should render").toBeVisible({
    timeout: CARD_TIMEOUT,
  });

  const seenCards = new Set<string>();
  let previousCardId: string | null = null;
  let repeatCount = 0;
  let reachedEnding = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const cardId = await getActiveCardId(page);

    if (!cardId) {
      // No active question card (no nav button) — we are on the ending card.
      reachedEnding = true;
      break;
    }

    if (cardId === previousCardId) {
      repeatCount += 1;
      // A second pass over the same card without progress = stall. The required field
      // we could not satisfy is a genuine problem; do not silently pass.
      expect(
        repeatCount,
        `Walker stalled on ${cardId} for variant "${variant}" — could not advance past a required field`
      ).toBeLessThan(2);
    } else {
      repeatCount = 0;
      previousCardId = cardId;
    }

    const card = page.locator(`[id="${cardId}"]`);

    if (!seenCards.has(cardId)) {
      seenCards.add(cardId);
      // Scan only once the fade-in has settled, and label the welcome card (block
      // index -1) clearly in scan output.
      await waitForCardSettled(page, cardId);
      await scan(page, variant, cardId === "questionCard--1" ? "welcome-card" : cardId, failSink);
    }

    await answerCurrentCard(page, card);

    const advance = advanceButton(card).first();
    await expect(
      advance,
      `advance button should be present on ${cardId} for variant "${variant}"`
    ).toBeVisible({ timeout: ACTION_TIMEOUT });
    await advance.click({ timeout: ACTION_TIMEOUT });

    // Wait for a stable next state (new active card or ending card). If we reached the
    // ending card, stop walking.
    const nextCardId = await waitForCardTransition(page, cardId);
    if (nextCardId === null && (await isOnEndingCard(page))) {
      reachedEnding = true;
      break;
    }
  }

  // Anti-silent-stall: prove we walked through several distinct cards (welcome +
  // multiple questions) AND positively reached the ending card. A stall leaves us on
  // a question card and fails here rather than being reported as "clean".
  expect(seenCards.size, `Expected to walk through multiple cards for variant "${variant}"`).toBeGreaterThan(
    2
  );

  if (!reachedEnding) {
    reachedEnding = await isOnEndingCard(page);
  }
  expect(
    reachedEnding,
    `Walker did not reach the ending card for variant "${variant}" — a stall must fail, not pass as clean`
  ).toBe(true);

  // The ending card is the concrete proof of completion; scan it too (settled, so the
  // fade-in cannot skew axe's contrast math).
  await expect(
    endingCardLocator(page).first(),
    `ending card should be visible for variant "${variant}"`
  ).toBeVisible({ timeout: CARD_TIMEOUT });
  await waitForLocatorSettled(endingCardLocator(page).first());
  await scan(page, variant, "ending-card", failSink);
};

/**
 * Opens the survey and advances past the welcome card, waiting for the card
 * transition to SETTLE before reading the active card id. Clicking Next and
 * immediately reading the active card would still see the welcome card
 * mid-animation, so both state tests use this instead of racing the transition.
 */
const openFirstQuestionCard = async (page: Page, surveyUrl: string): Promise<string> => {
  await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });
  const welcomeCard = activeCard(page).first();
  await expect(welcomeCard, "welcome card should render").toBeVisible({ timeout: CARD_TIMEOUT });
  const welcomeCardId = await welcomeCard.getAttribute("id");
  expect(welcomeCardId, "welcome card should have an id").toBeTruthy();

  await advanceButton(welcomeCard).first().click({ timeout: ACTION_TIMEOUT });

  const firstCardId = await waitForCardTransition(page, welcomeCardId ?? "");
  expect(firstCardId, "should land on the first question card after the welcome card").toBeTruthy();
  expect(firstCardId).not.toBe(welcomeCardId);
  return firstCardId ?? "";
};

/**
 * Aborts every request to the Cal.com embed origin, so the scheduler's third-party snippet
 * (packages/surveys cal-embed.tsx loads it from `https://cal.com/embed.js`) never runs and
 * never injects its cross-origin iframe.
 *
 * This is what makes a `cal` card scannable unattended at all. Left unblocked, the card's
 * axe result would depend on external network and on markup Formbricks neither owns nor can
 * fix — the reason the kitchen-sink fixture excludes the type outright. Blocked, what renders
 * is exactly the wrapper that IS ours: headline, subheader, and the embed container. The test
 * asserts the container stayed iframe-free, so the scan cannot silently grade Cal.com's DOM.
 */
const blockCalEmbedRequests = (page: Page): Promise<void> =>
  page.route(
    (url) => url.hostname === CAL_EMBED_ORIGIN || url.hostname.endsWith(`.${CAL_EMBED_ORIGIN}`),
    (route) => route.abort()
  );

/**
 * Clicks the current card's advance button and waits for a stable next card, asserting that
 * one arrived. Used by the answered-states walk, which needs the next card's id to scope its
 * assertions — unlike `walkAndScan`, which only needs to know it moved.
 */
const advanceToNextCard = async (page: Page, fromCardId: string): Promise<string> => {
  const advance = advanceButton(page.locator(`[id="${fromCardId}"]`)).first();
  await expect(advance, `advance button should be present on ${fromCardId}`).toBeVisible({
    timeout: ACTION_TIMEOUT,
  });
  await advance.click({ timeout: ACTION_TIMEOUT });
  const nextCardId = await waitForCardTransition(page, fromCardId);
  expect(nextCardId, `advancing past ${fromCardId} should land on the next card`).toBeTruthy();
  return nextCardId ?? "";
};

const reportAndAssert = (variant: string, failSink: ViolationRow[]): void => {
  if (failSink.length > 0) {
    logger.error(`\n=== ${failSink.length} WCAG AA violation(s) for variant "${variant}" ===`);
    // eslint-disable-next-line no-console -- surfaces the full violation table in the test log
    console.table(failSink);
  }
  expect(
    failSink,
    `WCAG 2.1/2.2 AA violations found for variant "${variant}" — see the table logged above`
  ).toEqual([]);
};

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TABLET_VIEWPORT = { width: 820, height: 1180 };

test.describe("Survey accessibility (axe-core) @slow", () => {
  // Seeded once per WORKER process and reused by every test in it: seeding writes
  // straight through Prisma (no login / dashboard / API-key UI), and the tests only
  // read the published surveys — responses never mutate them — so re-seeding per
  // test would add no isolation, only time.
  let seeded: SeededAccessibilitySurveys | undefined;

  test.beforeEach(async ({ page, users, baseURL }) => {
    await mockStorageUploads(page);
    seeded ??= await seedAccessibilitySurveys(users, baseURL ?? "http://localhost:3000");
  });

  test("desktop: full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "desktop", seeded.surveyUrl, violations);
    reportAndAssert("desktop", violations);
  });

  test("desktop: empty-submit validation state has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(120_000);
    const firstCardId = await openFirstQuestionCard(page, seeded.surveyUrl);
    const firstCard = page.locator(`[id="${firstCardId}"]`);

    // Submit the (required) first card empty to surface validation error states.
    const nextBtn = advanceButton(firstCard).first();
    await nextBtn.click({ timeout: ACTION_TIMEOUT });

    // The required-field error must keep us on the same card — assert no advance.
    await expect(page.locator(`[id="${firstCardId}"]`)).toBeVisible({ timeout: ACTION_TIMEOUT });
    expect(await getActiveCardId(page), "empty submit must not advance past the required first card").toBe(
      firstCardId
    );
    const violations: ViolationRow[] = [];
    await waitForCardSettled(page, firstCardId);
    await scan(page, "desktop-empty-submit", "first-card-validation", violations);
    reportAndAssert("desktop-empty-submit", violations);
  });

  test("desktop: back-navigation state has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(120_000);
    const firstCardId = await openFirstQuestionCard(page, seeded.surveyUrl);
    const firstCard = page.locator(`[id="${firstCardId}"]`);

    await answerCurrentCard(page, firstCard);
    await advanceButton(firstCard).first().click({ timeout: ACTION_TIMEOUT });

    // Wait until the active card changes (we moved forward), then go Back.
    await waitForCardTransition(page, firstCardId);

    const backBtn = page.getByRole("button", { name: "Back" }).first();
    await expect(backBtn, "back button should be available after advancing").toBeVisible({
      timeout: ACTION_TIMEOUT,
    });
    await backBtn.click({ timeout: ACTION_TIMEOUT });

    // Assert we actually returned to the first card as the ACTIVE card (prove back-nav worked).
    await expect
      .poll(() => getActiveCardId(page), {
        message: "back navigation should return to the first question card",
        timeout: CARD_TIMEOUT,
      })
      .toBe(firstCardId);
    const violations: ViolationRow[] = [];
    await waitForCardSettled(page, firstCardId);
    await scan(page, "desktop-back-nav", "first-card-after-back", violations);
    reportAndAssert("desktop-back-nav", violations);
  });

  /**
   * Answered-state coverage (ENG-1298).
   *
   * The walks above scan each card exactly once, BEFORE answering it, and deliberately never
   * answer the file input — so the markup a card renders only AFTER an interaction has never
   * reached axe. This scans that markup on the second fixture, one card per state:
   *
   * - the SELECTED day cell, whose `bg-brand` + `text-primary-foreground` pairing is chosen for
   *   contrast in packages/survey-ui but has never been measured by axe;
   * - the external CTA's in-card link button, a branch the kitchen sink never renders because it
   *   sets `buttonExternal: false`;
   * - the uploaded-file chip and its delete control, with the dropzone gone (single-file mode
   *   hides the uploader once a file is attached);
   * - the Cal.com scheduler wrapper, which cannot live in the kitchen sink at all.
   *
   * Every state is asserted BEFORE it is scanned, so a click that silently did nothing fails
   * here instead of being reported as clean — the same rule the walker's stall detection applies.
   *
   * One test, desktop only. These are card-local DOM states, so a second viewport, theme or
   * direction would re-scan the same nodes for the price of another full walk.
   */
  test("answered states: selected date, external CTA, uploaded file and scheduler wrapper have no WCAG AA violations", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await blockCalEmbedRequests(page);

    const variant = "answered-states";
    const violations: ViolationRow[] = [];

    // 1. Date — scan the card once a day is actually selected.
    const dateCardId = await openFirstQuestionCard(page, seeded.answeredStatesSurveyUrl);
    const dateCard = page.locator(`[id="${dateCardId}"]`);
    await expect(
      dateCard.getByRole("heading", { level: 2, name: DATE_HEADLINE }),
      "the answered-states walk should open on the date card"
    ).toBeVisible({ timeout: CARD_TIMEOUT });

    // The single-h1 contract (ENG-2336) is asserted on the kitchen sink further down, but it is a
    // per-survey property of the renderer, so hold the second fixture to it here too.
    await expect(
      page.locator("#fbjs").getByRole("heading", { level: 1 }),
      "the answered-states survey should expose its name as the page's one h1"
    ).toHaveText(A11Y_ANSWERED_STATES_SURVEY_NAME);

    await answerCurrentCard(page, dateCard);
    await expect(
      dateCard.locator('button[data-selected-single="true"]'),
      "a day must be selected before the selected-day state can be scanned"
    ).toHaveCount(1);
    await waitForCardSettled(page, dateCardId);
    await scan(page, variant, "date-day-selected", violations);

    // 2. External CTA — the extra in-card button is the whole point of this card, so assert it
    //    rendered. It is never clicked: it opens a new tab.
    const ctaCardId = await advanceToNextCard(page, dateCardId);
    const ctaCard = page.locator(`[id="${ctaCardId}"]`);
    await expect(
      ctaCard.getByRole("heading", { level: 2, name: CTA_EXTERNAL_HEADLINE }),
      "the date card should advance to the external CTA card"
    ).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(
      ctaCard.getByRole("button", { name: CTA_EXTERNAL_BUTTON_LABEL }),
      "the external CTA button should render, named by its ctaButtonLabel"
    ).toBeVisible({ timeout: ACTION_TIMEOUT });
    await waitForCardSettled(page, ctaCardId);
    await scan(page, variant, "cta-external-button", violations);

    // 3. File upload — attach a file through the mocked storage boundary, then scan the state
    //    the walker skips. The card is REQUIRED, so advancing past it (step 4) is only possible
    //    if the upload really produced a response value.
    const uploadCardId = await advanceToNextCard(page, ctaCardId);
    const uploadCard = page.locator(`[id="${uploadCardId}"]`);
    await expect(
      uploadCard.getByRole("heading", { level: 2, name: FILE_UPLOAD_HEADLINE }),
      "the CTA card should advance to the file upload card"
    ).toBeVisible({ timeout: CARD_TIMEOUT });

    await uploadCard.locator('input[type="file"]').setInputFiles({
      name: UPLOAD_FIXTURE_FILE_NAME,
      mimeType: "image/svg+xml",
      buffer: UPLOAD_FIXTURE_BODY,
    });

    const deleteControl = uploadCard.getByRole("button", { name: /^Delete / });
    await expect(
      deleteControl,
      "the uploaded file should render exactly one delete control, named after the file"
    ).toHaveCount(1);
    await expect(deleteControl).toHaveAccessibleName(new RegExp(`^Delete .*${UPLOAD_FIXTURE_STEM}`));
    await expect(
      uploadCard.locator('input[type="file"]'),
      "single-file upload hides the dropzone once a file is attached — that is the state under scan"
    ).toHaveCount(0);
    await waitForCardSettled(page, uploadCardId);
    await scan(page, variant, "file-upload-attached", violations);

    // 4. Cal.com scheduler — our wrapper only. The embed origin is aborted, so the container
    //    must be empty; assert that, or this scan would be grading third-party markup.
    const calCardId = await advanceToNextCard(page, uploadCardId);
    const calCard = page.locator(`[id="${calCardId}"]`);
    await expect(
      calCard.getByRole("heading", { level: 2, name: CAL_HEADLINE }),
      "a required file upload must accept the mocked upload and advance to the scheduler card"
    ).toBeVisible({ timeout: CARD_TIMEOUT });

    const calContainer = calCard.locator('[id^="cal-embed-"]');
    await expect(calContainer, "the scheduler wrapper should render").toHaveCount(1);
    await expect(
      calContainer.locator("iframe"),
      "the third-party Cal.com embed must stay blocked: this scan covers our wrapper only"
    ).toHaveCount(0);
    await waitForCardSettled(page, calCardId);
    await scan(page, variant, "cal-scheduler-wrapper", violations);

    // Prove the whole walk completed rather than stalling on a card we could not answer.
    // `advanceToNextCard` is not reused here: the next state is the ending card, which has no
    // card id of its own, so it would fail that helper's "landed on the next card" assertion.
    await advanceButton(calCard).first().click({ timeout: ACTION_TIMEOUT });
    await waitForCardTransition(page, calCardId);
    await expect(
      endingCardLocator(page).first(),
      "the answered-states walk should reach the ending card"
    ).toBeVisible({ timeout: CARD_TIMEOUT });

    reportAndAssert(variant, violations);
  });

  test("mobile: full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(MOBILE_VIEWPORT);
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "mobile", seeded.surveyUrl, violations);
    reportAndAssert("mobile", violations);
  });

  test("tablet: full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(TABLET_VIEWPORT);
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "tablet", seeded.surveyUrl, violations);
    reportAndAssert("tablet", violations);
  });

  test("forced-colors (high contrast): full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ forcedColors: "active" });
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "forced-colors", seeded.surveyUrl, violations);
    reportAndAssert("forced-colors", violations);
  });

  test("reduced-motion: full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "reduced-motion", seeded.surveyUrl, violations);
    reportAndAssert("reduced-motion", violations);
  });

  test.describe("dark color scheme", () => {
    test.use({ colorScheme: "dark" });

    test("dark mode: full walk has no WCAG AA violations", async ({ page }) => {
      test.setTimeout(180_000);
      const violations: ViolationRow[] = [];
      await walkAndScan(page, "dark", seeded.surveyUrl, violations);
      reportAndAssert("dark", violations);
    });
  });

  /**
   * Heading structure (ENG-2336, WCAG 2.4.6). axe cannot gate this: `page-has-heading-one` and
   * `heading-order` are best-practice rules, so they only WARN in this suite. The three things
   * that can silently regress are asserted directly — the single h1, the absence of a skipped
   * level, and the two associations the heading wrapper had to preserve (`htmlFor` on the nested
   * label, and `headlineId` still naming the radiogroup through aria-labelledby).
   */
  test("heading structure: one h1 names the survey, card headlines are h2", async ({ page }) => {
    test.setTimeout(120_000);
    const widget = page.locator("#fbjs");

    await page.goto(seeded.surveyUrl, { waitUntil: "domcontentloaded" });
    await expect(activeCard(page).first(), "welcome card should render").toBeVisible({
      timeout: CARD_TIMEOUT,
    });

    // One h1 for the whole survey, carrying the survey name. Without it every card headline is an
    // orphaned h2 and heading navigation gives the respondent no idea what they are answering.
    await expect(widget.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(widget.getByRole("heading", { level: 1 })).toHaveText(A11Y_SURVEY_NAME);

    // Nothing deeper than h2 anywhere, so h1 -> h2 cannot become a skipped level.
    await expect(widget.locator("h3, h4, h5, h6")).toHaveCount(0);

    await expect(
      page.getByRole("heading", { level: 2, name: WELCOME_CARD_HEADLINE }),
      "welcome card headline should be an h2, not a styled div"
    ).toBeVisible();

    const firstCardId = await openFirstQuestionCard(page, seeded.surveyUrl);
    const firstCard = page.locator(`[id="${firstCardId}"]`);

    // Still exactly one h1 on a question card: the heading lives on the container, so the stacked
    // layout's peeking cards must not each contribute their own.
    await expect(widget.getByRole("heading", { level: 1 })).toHaveCount(1);

    // The open-text prompt is an h2 that WRAPS the <label> bound to the input. If a future refactor
    // turns the label itself into the heading, the input loses its accessible name — hence both
    // halves are asserted: the heading contains a real label[for], and the input resolves by label.
    const promptHeading = firstCard.getByRole("heading", { level: 2, name: OPEN_TEXT_HEADLINE });
    await expect(promptHeading).toBeVisible();
    await expect(promptHeading.locator("label[for]")).toHaveCount(1);
    await expect(firstCard.getByLabel(OPEN_TEXT_HEADLINE)).toBeVisible();

    // Advance to the single-select card: its radiogroup is named through aria-labelledby pointing at
    // the headline id, which now sits on an element nested inside the h2.
    await answerCurrentCard(page, firstCard);
    await advanceButton(firstCard).first().click({ timeout: ACTION_TIMEOUT });
    await waitForCardTransition(page, firstCardId);

    await expect(
      page.getByRole("radiogroup", { name: SINGLE_SELECT_HEADLINE }),
      "the radiogroup must still be named by its headline via aria-labelledby"
    ).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(page.getByRole("heading", { level: 2, name: SINGLE_SELECT_HEADLINE })).toBeVisible();
  });

  test("rtl multi-language (Arabic): full walk has no WCAG AA violations", async ({ page }) => {
    test.setTimeout(180_000);
    // Confirm the survey actually renders right-to-left before scanning, so this
    // variant genuinely exercises RTL rather than silently falling back to LTR.
    await page.goto(seeded.rtlSurveyUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[dir="rtl"]').first(), "survey should render RTL for ?lang=ar").toBeVisible({
      timeout: CARD_TIMEOUT,
    });
    const violations: ViolationRow[] = [];
    await walkAndScan(page, "rtl-arabic", seeded.rtlSurveyUrl, violations);
    reportAndAssert("rtl-arabic", violations);
  });
});
