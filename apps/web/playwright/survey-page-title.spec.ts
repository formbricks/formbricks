import { createId } from "@paralleldrive/cuid2";
import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Per-step document titles on a public link survey (ENG-2334, WCAG 2.4.2).
 *
 * `generateMetadata` gives the page one title for its whole lifetime — it cannot know which card the
 * respondent is on, because that lives in the renderer's state and the server never sees it. So the
 * title stayed identical from the first question to the last, giving a screen-reader user no
 * orientation on navigation.
 *
 * This is the one behaviour in the change that is only observable end to end: the pieces either side
 * (`getSurveyPagePosition`, `buildSurveyDocumentTitle`) are unit-tested, but the wiring between them
 * runs across the Preact bundle → `onPageChange` → the React host's `document.title`, and axe cannot
 * judge title descriptiveness at all. `cross-tenant-survey-access.spec.ts` is the existing
 * `toHaveTitle` precedent.
 *
 * Seeds straight through Prisma — the same boundary the `users` fixture writes through — so no login
 * is needed, and with the welcome card DISABLED so the base title falls through to the survey name
 * (`getBasicSurveyMetadata` prefers the welcome headline when there is one). Created as `inProgress`
 * because `/s/<id>` 404s for drafts.
 */

const i18nValue = (value: string) => ({ default: value });

const SURVEY_NAME = "Page title a11y survey";
const HEADLINES = ["What brought you here?", "How did you hear about us?", "Anything else?"];
/** 3 blocks + 1 ending, no welcome card. Matches getSurveyPagePosition's card count. */
const TOTAL_PAGES = HEADLINES.length + 1;

const CARD_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 8_000;

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const seedSurvey = async (workspaceId: string, createdBy: string): Promise<string> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: i18nValue("Thanks!") },
  ] as unknown as TSurveyEnding[];
  const questions = HEADLINES.map((headline) => ({
    id: createId(),
    type: "openText",
    headline: i18nValue(headline),
    // Optional, so the walk is pure navigation: the title must depend on the card position, never
    // on whether an answer was given.
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
  }));

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: SURVEY_NAME,
      type: "link",
      status: "inProgress",
      welcomeCard: { enabled: false } as unknown as Prisma.InputJsonValue,
      blocks: transformQuestionsToBlocks(
        questions as unknown as TLegacyQuestions,
        endings
      ) as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });
  return survey.id;
};

/** Only the current card's nav button is focusable; peeking cards render theirs with tabindex -1. */
const advanceButton = (page: import("@playwright/test").Page) =>
  page.locator('button.border-submit-button-border:not([tabindex="-1"])').first();

test.describe("Public survey page titles", () => {
  let surveyUrl: string;

  test.beforeEach(async ({ users }) => {
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    surveyUrl = `/s/${await seedSurvey(user.workspaceId, user.id)}`;
  });

  test("the title names the survey and the current page, and follows navigation", async ({ page }) => {
    await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(HEADLINES[0]), "first card should render").toBeVisible({
      timeout: CARD_TIMEOUT,
    });

    // The survey name has to survive: the step is appended to the server-rendered title rather than
    // replacing it, so a custom link-metadata title is never clobbered.
    await expect(page).toHaveTitle(new RegExp(SURVEY_NAME));
    await expect(page).toHaveTitle(new RegExp(`Page 1 of ${TOTAL_PAGES.toString()}`));

    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    await expect(page.getByText(HEADLINES[1])).toBeVisible({ timeout: CARD_TIMEOUT });

    // The whole point: the title moves with the respondent. Before this change it was frozen.
    await expect(page).toHaveTitle(new RegExp(`Page 2 of ${TOTAL_PAGES.toString()}`));
    await expect(page).toHaveTitle(new RegExp(SURVEY_NAME));

    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    await expect(page.getByText(HEADLINES[2])).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(page).toHaveTitle(new RegExp(`Page 3 of ${TOTAL_PAGES.toString()}`));

    // The ending card is the last page, so the count must land exactly on the total rather than
    // overshooting it.
    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    await expect(page.getByText("Thanks!")).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(page).toHaveTitle(new RegExp(`Page ${TOTAL_PAGES.toString()} of ${TOTAL_PAGES.toString()}`));
  });

  test("the survey exposes a named form landmark with its instructions", async ({ page, users }) => {
    // The other half of the VPAT finding: "forms themselves have no titles", and the instructions
    // were shown once on the welcome card and never again. Seeded WITH a welcome card here, since
    // its subheader is the only instructions text a survey has.
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const endings = [
      { id: createId(), type: "endScreen" as const, headline: i18nValue("Thanks!") },
    ] as unknown as TSurveyEnding[];
    const survey = await prisma.survey.create({
      data: {
        workspaceId: user.workspaceId,
        createdBy: user.id,
        name: "Instructions survey",
        type: "link",
        status: "inProgress",
        welcomeCard: {
          enabled: true,
          headline: i18nValue("Welcome"),
          subheader: i18nValue("Answer honestly, there are no wrong answers."),
          timeToFinish: false,
          showResponseCount: false,
        } as unknown as Prisma.InputJsonValue,
        blocks: transformQuestionsToBlocks(
          [
            {
              id: createId(),
              type: "openText",
              headline: i18nValue(HEADLINES[0]),
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ] as unknown as TLegacyQuestions,
          endings
        ) as unknown as Prisma.InputJsonValue[],
        endings: endings as unknown as Prisma.InputJsonValue[],
      },
      select: { id: true },
    });

    await page.goto(`/s/${survey.id}`, { waitUntil: "domcontentloaded" });

    const form = page.locator("#fbjs");
    await expect(form).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(form).toHaveAttribute("role", "form");
    await expect(form).toHaveAttribute("aria-label", "Instructions survey");
    await expect(form).toHaveAttribute("aria-describedby", "fb__survey-instructions");

    const instructions = page.locator("#fb__survey-instructions");
    await expect(instructions).toHaveCount(1);
    await expect(instructions).toContainText("Answer honestly, there are no wrong answers.");

    // Persistence is the requirement: advance past the welcome card and the region must still be
    // there, still singular. The stacked layout keeps several cards mounted, so a duplicated id
    // would break the aria-describedby reference — hence the count assertion after navigating too.
    await advanceButton(page).click({ timeout: ACTION_TIMEOUT });
    await expect(page.getByText(HEADLINES[0])).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(page.locator("#fb__survey-instructions")).toHaveCount(1);
    await expect(page.locator("#fb__survey-instructions")).toContainText(
      "Answer honestly, there are no wrong answers."
    );
  });
});
