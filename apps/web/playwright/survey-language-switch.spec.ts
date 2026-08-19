import { createId } from "@paralleldrive/cuid2";
import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * Language identification in the public survey's language switcher (ENG-2335, WCAG 3.1.1).
 *
 * The switcher used to be an unlabelled globe icon that was never told which language was active,
 * so neither a sighted nor a screen-reader user could tell what language the survey was in, and the
 * dropdown marked no option as current. The `#fbjs` root also carried no `lang` at all, which is the
 * only signal an EMBEDDED survey has — a link survey's host page additionally syncs `<html lang>`,
 * but the JS widget is dropped into someone else's document and must not touch it.
 *
 * None of this is reachable by axe: `html-has-lang` passes on the host page's own attribute, and no
 * rule can judge whether an icon-only control names the state it controls. Hence an explicit spec.
 *
 * Seeds its own three-language survey straight through Prisma — the same boundary the `users`
 * fixture writes through — so no login or dashboard step is needed. The legacy `questions` shape is
 * converted with the SAME `transformQuestionsToBlocks` the v1 management API uses server-side, so
 * the stored blocks cannot drift from the API contract. Created as `inProgress` because `/s/<id>`
 * 404s for drafts.
 */

type I18n = { default: string; [lang: string]: string };

// Named so the i18n scanner's t(...) pattern does not treat these fixture strings as translation
// keys (utils/*.ts is scanned; *.spec.ts files are not, but the shape is kept consistent).
const i18nValue = (value: string): I18n => ({ default: value });

const SURVEY_NAME = "Language switch a11y";
const QUESTION_HEADLINE = "How did you hear about us?";

/**
 * Canonical BCP-47 codes: stored language codes are canonicalized (PR #8390), so `de-DE` rather
 * than `de`. English is the default; German and Japanese are enabled alternatives.
 *
 * Japanese is in the fixture on purpose: its endonym is in a non-Latin script, so it proves the
 * per-option `lang` attribute is present for the case that actually matters for pronunciation.
 */
const DEFAULT_CODE = "en-US";
const GERMAN_CODE = "de-DE";
const JAPANESE_CODE = "ja-JP";

/**
 * Expected labels, from packages/surveys/src/lib/language-display-name.ts. The dropdown shows the
 * full region-qualified endonym (so "Português (Brasil)" can be told from "Português (Portugal)");
 * the trigger shows the region-less form, which is short enough for the chrome row.
 */
const FULL_NAME = { [DEFAULT_CODE]: "American English", [GERMAN_CODE]: "Deutsch (Deutschland)" };
const SHORT_NAME = { [DEFAULT_CODE]: "English", [GERMAN_CODE]: "Deutsch" };
const JAPANESE_NAME = "日本語";

const CARD_TIMEOUT = 15_000;
const ACTION_TIMEOUT = 8_000;

const buildQuestions = () => [
  {
    id: createId(),
    type: "openText",
    headline: i18nValue(QUESTION_HEADLINE),
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
  },
];

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

/**
 * Creates a published link survey with the language switcher enabled and three enabled languages.
 * The language relation is keyed by a real `Language.id` that must already exist in the workspace,
 * hence the upserts.
 */
const seedMultiLanguageSurvey = async (workspaceId: string, createdBy: string): Promise<string> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: i18nValue("Thanks!") },
  ] as unknown as TSurveyEnding[];
  const blocks = transformQuestionsToBlocks(buildQuestions() as unknown as TLegacyQuestions, endings);

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: SURVEY_NAME,
      type: "link",
      status: "inProgress",
      showLanguageSwitch: true,
      welcomeCard: { enabled: false } as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });

  const languages = await Promise.all(
    [DEFAULT_CODE, GERMAN_CODE, JAPANESE_CODE].map((code) =>
      prisma.language.upsert({
        where: { workspaceId_code: { workspaceId, code } },
        update: {},
        create: { id: createId(), code, workspaceId },
      })
    )
  );

  await prisma.surveyLanguage.createMany({
    data: languages.map((language) => ({
      surveyId: survey.id,
      languageId: language.id,
      default: language.code === DEFAULT_CODE,
      enabled: true,
    })),
    skipDuplicates: true,
  });

  return survey.id;
};

/**
 * The switcher trigger. Matched by `aria-haspopup` rather than by its accessible name, because the
 * name is exactly what these tests assert on — locating by it would make every assertion circular.
 */
const switcherTrigger = (page: Page): Locator => page.locator('#fbjs button[aria-haspopup="true"]');

const dropdownOption = (page: Page, name: string): Locator =>
  page.locator("#fbjs").getByRole("button", { name, exact: true });

const surveyRootLang = (page: Page): Promise<string | null> => page.locator("#fbjs").getAttribute("lang");

test.describe("Survey language switcher identifies the current language", () => {
  let surveyUrl: string;

  test.beforeEach(async ({ users }) => {
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const surveyId = await seedMultiLanguageSurvey(user.workspaceId, user.id);
    surveyUrl = `/s/${surveyId}`;
  });

  test("trigger names the active language and the survey root declares it", async ({ page }) => {
    await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });

    const trigger = switcherTrigger(page);
    await expect(trigger, "the language switcher should render for a multi-language survey").toBeVisible({
      timeout: CARD_TIMEOUT,
    });

    // The whole finding: the control now states which language it is showing.
    await expect(trigger).toHaveAccessibleName(new RegExp(FULL_NAME[DEFAULT_CODE]));
    // And states it visibly, in the shorter region-less form.
    await expect(trigger).toContainText(SHORT_NAME[DEFAULT_CODE]);

    // The survey root declares the survey's language — the only such signal an embedded survey has.
    expect(await surveyRootLang(page)).toBe(DEFAULT_CODE);
  });

  test("dropdown marks the active option and tags each option with its own language", async ({ page }) => {
    await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });
    await expect(switcherTrigger(page)).toBeVisible({ timeout: CARD_TIMEOUT });
    await switcherTrigger(page).click({ timeout: ACTION_TIMEOUT });

    const active = dropdownOption(page, FULL_NAME[DEFAULT_CODE]);
    await expect(active, "the default language option should render").toBeVisible({
      timeout: ACTION_TIMEOUT,
    });
    await expect(active).toHaveAttribute("aria-current", "true");

    // Exactly one option is current — a stale marker on a second option would be worse than none.
    await expect(page.locator('#fbjs [aria-current="true"]')).toHaveCount(1);
    await expect(dropdownOption(page, FULL_NAME[GERMAN_CODE])).not.toHaveAttribute("aria-current", "true");

    // Each label is written in its own language, so each needs its own `lang` or a screen reader
    // pronounces it with the page language's rules. Japanese is the case that shows it up.
    await expect(dropdownOption(page, JAPANESE_NAME)).toHaveAttribute("lang", JAPANESE_CODE);
    await expect(dropdownOption(page, FULL_NAME[GERMAN_CODE])).toHaveAttribute("lang", GERMAN_CODE);
  });

  test("switching language moves the marker, the trigger name and the root lang", async ({ page }) => {
    await page.goto(surveyUrl, { waitUntil: "domcontentloaded" });
    await expect(switcherTrigger(page)).toBeVisible({ timeout: CARD_TIMEOUT });
    await switcherTrigger(page).click({ timeout: ACTION_TIMEOUT });
    await dropdownOption(page, FULL_NAME[GERMAN_CODE]).click({ timeout: ACTION_TIMEOUT });

    // All three signals have to follow the switch, not just the rendered content.
    await expect(switcherTrigger(page)).toHaveAccessibleName(new RegExp(FULL_NAME[GERMAN_CODE]));
    await expect(switcherTrigger(page)).toContainText(SHORT_NAME[GERMAN_CODE]);
    await expect
      .poll(() => surveyRootLang(page), {
        message: "the survey root lang should follow the selected language",
        timeout: ACTION_TIMEOUT,
      })
      .toBe(GERMAN_CODE);

    await switcherTrigger(page).click({ timeout: ACTION_TIMEOUT });
    await expect(dropdownOption(page, FULL_NAME[GERMAN_CODE])).toHaveAttribute("aria-current", "true");
    await expect(dropdownOption(page, FULL_NAME[DEFAULT_CODE])).not.toHaveAttribute("aria-current", "true");
    await expect(page.locator('#fbjs [aria-current="true"]')).toHaveCount(1);
  });

  test("the language switcher is absent when the survey has one language", async ({ page, users }) => {
    // Guard: `lang` on the root must not depend on the switcher being rendered, and a
    // single-language survey should not grow a control it never had.
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const endings = [
      { id: createId(), type: "endScreen" as const, headline: i18nValue("Thanks!") },
    ] as unknown as TSurveyEnding[];
    const survey = await prisma.survey.create({
      data: {
        workspaceId: user.workspaceId,
        createdBy: user.id,
        name: "Single language",
        type: "link",
        status: "inProgress",
        welcomeCard: { enabled: false } as unknown as Prisma.InputJsonValue,
        blocks: transformQuestionsToBlocks(
          buildQuestions() as unknown as TLegacyQuestions,
          endings
        ) as unknown as Prisma.InputJsonValue[],
        endings: endings as unknown as Prisma.InputJsonValue[],
      },
      select: { id: true },
    });

    await page.goto(`/s/${survey.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(QUESTION_HEADLINE)).toBeVisible({ timeout: CARD_TIMEOUT });
    await expect(switcherTrigger(page)).toHaveCount(0);
    // No configured languages means nothing to declare: the survey inherits the document's language
    // rather than asserting a guess.
    expect(await surveyRootLang(page)).toBeNull();
  });
});
