import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Overflowing welcome and CTA cards must open at the START of their text (ENG-2289).
 *
 * Both cards move focus to a button rendered BELOW the card's text, inside the same scroll
 * area. Focusing it without `preventScroll` makes the browser scroll that button into view,
 * so a respondent who has not read a word lands at the end of the intro. The two focus paths
 * are separate — the welcome card's start button focuses itself (`SubmitButton`), a CTA
 * block's Next button is picked up by `focusFirstControl` on mount because a non-external
 * CTA renders no control of its own — so each gets its own case, in both card arrangements
 * (a card scrolls its own `max-height` box; the cardless arrangement, the default for link
 * surveys, scrolls an outer wrapper instead).
 *
 * The button must still END UP FOCUSED: dropping the autofocus would also stop the scroll
 * jump while silently costing keyboard and screen-reader users their entry point, so every
 * case asserts focus as well as scroll position.
 */

type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

/**
 * Long enough that the card cannot fit its text at any viewport this suite runs at. The
 * snapshot below asserts that something actually overflows, so a fixture that stopped
 * overflowing fails the test instead of passing it vacuously.
 */
const longText = (subject: string): string =>
  Array.from(
    { length: 40 },
    (_, index) =>
      `Paragraph ${String(index + 1)}: ${subject} — this text is deliberately long so the card has to scroll.`
  ).join(" ");

const WELCOME_HEADLINE = "Welcome to the long intro";
const WELCOME_BUTTON_LABEL = "Start the survey";
const CTA_HEADLINE = "Read this before you continue";
const ENDING_HEADLINE = "Thanks for reading!";

const buildQuestions = () => [
  {
    id: createId(),
    type: "cta",
    headline: i18nValue(CTA_HEADLINE),
    subheader: i18nValue(longText("the call to action")),
    required: false,
    // A non-external CTA renders no control of its own, so the block's Next button — after
    // the text — is the first focusable element. That is the case the bug report describes.
    buttonExternal: false,
  },
  {
    id: createId(),
    type: "openText",
    headline: i18nValue("Anything else to add?"),
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
  },
];

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

/**
 * Seeds a published link survey straight through Prisma — the same boundary the `users`
 * fixture writes through — converting the legacy `questions` shape with the transform the
 * v1 management API uses server-side, so the stored blocks cannot drift from the API
 * contract. Created as `inProgress` because `/s/<id>` 404s for drafts.
 */
const seedOverflowingSurvey = async (
  workspaceId: string,
  createdBy: string,
  options: { name: string; styling?: Record<string, unknown> }
): Promise<string> => {
  const endings = [
    {
      id: createId(),
      type: "endScreen" as const,
      headline: i18nValue(ENDING_HEADLINE),
    },
  ] as unknown as TSurveyEnding[];
  const blocks = transformQuestionsToBlocks(buildQuestions() as unknown as TLegacyQuestions, endings);

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: options.name,
      type: "link",
      status: "inProgress",
      welcomeCard: {
        enabled: true,
        headline: i18nValue(WELCOME_HEADLINE),
        subheader: i18nValue(longText("the welcome card")),
        buttonLabel: i18nValue(WELCOME_BUTTON_LABEL),
        timeToFinish: false,
        showResponseCount: false,
      } as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
      ...(options.styling ? { styling: options.styling as Prisma.InputJsonValue } : {}),
    },
    select: { id: true },
  });
  return survey.id;
};

/**
 * Off-screen stacked cards render a dummy copy of the nav buttons with `tabindex="-1"`;
 * only the current card's button is focusable. Same locator shape as survey-keyboard.spec.ts.
 */
const navButton = (page: Page, name: string | RegExp): Locator =>
  page.getByRole("button", { name }).and(page.locator('[tabindex="0"]'));

interface ScrollSnapshot {
  /** Boxes whose content does not fit — at least one proves the fixture really overflows. */
  overflowing: number;
  /** The furthest any scrollable element has been scrolled from its top. */
  maxScrollTop: number;
  windowScrollY: number;
}

/**
 * Reads every scrollable box on the page in ONE evaluate. Which box actually scrolls depends
 * on the card arrangement, so the check is deliberately shape-agnostic: nothing may be
 * scrolled away from the top while the card is still being read for the first time.
 */
const readScrollState = (page: Page): Promise<ScrollSnapshot> =>
  page.evaluate(() => {
    const overflows = (element: Element): boolean => element.scrollHeight - element.clientHeight > 1;

    const scrollers = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((element) => {
      const overflowY = getComputedStyle(element).overflowY;
      return overflows(element) && (overflowY === "auto" || overflowY === "scroll");
    });

    const documentScroller = document.scrollingElement;

    return {
      overflowing: scrollers.length + (documentScroller && overflows(documentScroller) ? 1 : 0),
      maxScrollTop: scrollers.reduce((max, element) => Math.max(max, Math.round(element.scrollTop)), 0),
      windowScrollY: Math.round(window.scrollY),
    };
  });

const expectOpenedAtTop = async (page: Page, headline: Locator): Promise<void> => {
  const snapshot = await readScrollState(page);
  expect(snapshot.overflowing, "fixture text must overflow the card, or this proves nothing").toBeGreaterThan(
    0
  );
  // 1px of tolerance, for the same zoom/rounding reasons ScrollableContainer applies it.
  expect(snapshot.maxScrollTop, "the card must open at the top of its text").toBeLessThanOrEqual(1);
  expect(snapshot.windowScrollY, "the page itself must not scroll on load").toBeLessThanOrEqual(1);
  await expect(headline, "the first line of the card must be on screen").toBeInViewport();
};

const ARRANGEMENTS = [
  {
    name: "card arrangement",
    styling: {
      overwriteThemeStyling: true,
      cardArrangement: { linkSurveys: "simple", appSurveys: "simple" },
    },
  },
  // No styling override: link surveys default to the cardless arrangement, where the card's
  // own scroll area is disabled and an outer wrapper scrolls instead.
  { name: "cardless arrangement", styling: undefined },
] as const;

for (const arrangement of ARRANGEMENTS) {
  test.describe(`Overflowing cards open at the top (${arrangement.name})`, () => {
    // Seeded once and reused: the fixtures are per-test, so this is done lazily in
    // beforeEach (same pattern as survey-keyboard.spec.ts).
    let surveyUrl: string | undefined;

    test.beforeEach(async ({ users }) => {
      if (surveyUrl) return;
      const user = await users.create({ skipSurveySeed: true });
      if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
      const surveyId = await seedOverflowingSurvey(user.workspaceId, user.id, {
        name: `Overflowing cards (${arrangement.name})`,
        styling: arrangement.styling,
      });
      surveyUrl = `/s/${surveyId}`;
    });

    test("welcome card shows the start of its text, with the start button focused", async ({ page }) => {
      await page.goto(surveyUrl ?? "");

      const headline = page.getByRole("heading", { name: WELCOME_HEADLINE });
      await expect(headline).toBeVisible();

      // The start button focuses itself ~200ms after the card mounts; waiting for that puts
      // the scroll assertion AFTER the moment the position used to jump.
      await expect(navButton(page, WELCOME_BUTTON_LABEL)).toBeFocused({ timeout: 5000 });

      await expectOpenedAtTop(page, headline);
    });

    test("CTA card shows the start of its text, with the next button focused", async ({ page }) => {
      await page.goto(surveyUrl ?? "");

      // Advance from the keyboard once the start button has focus, rather than clicking it:
      // Playwright scrolls a locator into view before clicking, and the cardless arrangement's
      // scroll wrapper outlives the card — so that scroll would still be in place when the CTA
      // card mounts and would fake the very symptom under test. Space activates the focused
      // button natively; Enter is not equivalent, because the welcome card passes an `onKeyDown`
      // that suppresses the button's own Enter activation.
      await expect(navButton(page, WELCOME_BUTTON_LABEL)).toBeFocused({ timeout: 5000 });
      await page.keyboard.press("Space");

      const headline = page.getByRole("heading", { name: CTA_HEADLINE });
      await expect(headline).toBeVisible();

      // Mount focus lands on the block's Next button — the CTA element has no control of its own.
      await expect(navButton(page, "Next")).toBeFocused({ timeout: 5000 });

      await expectOpenedAtTop(page, headline);
    });
  });
}
