import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { type UsersFixture } from "../fixtures/users";

// The transform's own (legacy v1) question input type, derived from its signature so
// this file does not reference the deprecated TSurveyQuestion name directly.
type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

/**
 * Self-seeding helpers for the survey accessibility (axe-core) suite.
 *
 * The suite must run unattended in the normal Playwright job, so it provisions
 * its own published "kitchen-sink" link survey instead of reading a manual
 * SURVEY_URL. Seeding goes straight through Prisma — the same boundary the
 * `users` fixture writes through — so no login, dashboard navigation, or API key
 * is needed. To stay aligned with the real survey schema, the legacy `questions`
 * shape is converted with the SAME `transformQuestionsToBlocks` the v1 management
 * API uses server-side, instead of hand-crafting blocks JSON. The survey is
 * created directly as `inProgress` because `/s/<id>` returns 404 for drafts
 * (see apps/web/modules/survey/link/components/survey-renderer.tsx).
 *
 * The multi-language / RTL variant additionally creates a real Arabic `Language`
 * row + `SurveyLanguage` join, and patches Arabic translation keys into the
 * stored blocks so axe scans genuine RTL content; `?lang=ar-EG` then renders the
 * survey with `dir="rtl"` (see packages/surveys/src/lib/utils.ts `isRTLLanguage`).
 *
 * A THIRD fixture — the "answered states" survey — carries the cards whose
 * post-interaction DOM the kitchen-sink walker can never reach, plus the one
 * question type the kitchen sink cannot hold at all (ENG-1298). See
 * `buildAnsweredStatesQuestions` for what each card is there to expose.
 */

type I18n = { default: string; [lang: string]: string };

// Named so the i18n scanner's t(...) pattern does not treat these fixture
// strings as translation keys (this file is scanned; *.spec.ts files are not).
const i18nValue = (value: string): I18n => ({ default: value });

// A stable, valid storage URL for picture-selection choices. Public assets under
// apps/web/public are always served by the app and satisfy ZStorageUrl, so the
// picture-select card renders without depending on the storage mock.
const pictureUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString();

/**
 * Builds the kitchen-sink question list covering every renderable question type.
 * IDs use cuid2 (alphanumeric, allowed by ZSurveyQuestionId) and are unique per
 * call so parallel workers never collide.
 */
const buildKitchenSinkQuestions = (baseURL: string) => [
  {
    id: createId(),
    type: "openText",
    headline: i18nValue(OPEN_TEXT_HEADLINE),
    subheader: i18nValue("Share anything that comes to mind."),
    placeholder: i18nValue("Type your answer here..."),
    required: true,
    inputType: "text",
    charLimit: { enabled: false },
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: i18nValue(SINGLE_SELECT_HEADLINE),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Free") },
      { id: createId(), label: i18nValue("Pro") },
      { id: createId(), label: i18nValue("Enterprise") },
    ],
  },
  {
    id: createId(),
    type: "multipleChoiceMulti",
    headline: i18nValue("Which features do you use? (select all that apply)"),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Surveys") },
      { id: createId(), label: i18nValue("Contacts") },
      { id: createId(), label: i18nValue("Integrations") },
    ],
  },
  {
    id: createId(),
    type: "rating",
    headline: i18nValue("How would you rate your experience?"),
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: i18nValue("Poor"),
    upperLabel: i18nValue("Excellent"),
  },
  {
    id: createId(),
    type: "ranking",
    headline: i18nValue("Rank these in order of importance"),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Speed") },
      { id: createId(), label: i18nValue("Reliability") },
      { id: createId(), label: i18nValue("Support") },
    ],
  },
  {
    id: createId(),
    type: "matrix",
    headline: i18nValue("How much do you agree?"),
    required: true,
    rows: [
      { id: createId(), label: i18nValue("The product is easy to use") },
      { id: createId(), label: i18nValue("Support is responsive") },
    ],
    columns: [
      { id: createId(), label: i18nValue("Agree") },
      { id: createId(), label: i18nValue("Neutral") },
      { id: createId(), label: i18nValue("Disagree") },
    ],
  },
  {
    id: createId(),
    type: "date",
    headline: i18nValue("When did you start using us?"),
    required: true,
    format: "M-d-y",
  },
  {
    id: createId(),
    type: "fileUpload",
    headline: i18nValue("Upload a screenshot (optional)"),
    required: false,
    allowMultipleFiles: false,
  },
  // NOTE: no `cal` question on purpose — the Cal.com embed loads a live third-party
  // iframe, which would make the unattended axe walk depend on external network and
  // markup we do not control (its violations would all be wontfix-allowlisted anyway).
  // The wrapper Formbricks DOES own is scanned in `buildAnsweredStatesQuestions`
  // below, where the spec blocks the embed origin instead of loading it.
  {
    id: createId(),
    type: "pictureSelection",
    headline: i18nValue("Pick the image you prefer"),
    required: true,
    allowMulti: false,
    choices: [
      { id: createId(), imageUrl: pictureUrl(baseURL, "/logo-transparent.png") },
      { id: createId(), imageUrl: pictureUrl(baseURL, "/favicon/android-chrome-192x192.png") },
    ],
  },
  {
    id: createId(),
    type: "cta",
    headline: i18nValue("Thanks for the detail!"),
    subheader: i18nValue("Tap continue to wrap up."),
    required: false,
    buttonExternal: false,
  },
];

/**
 * Builds the "answered states" question list (ENG-1298).
 *
 * The kitchen-sink walker scans each card exactly once, BEFORE it answers it, and
 * skips the file input entirely — so a whole class of DOM has never reached axe:
 * the markup a card only renders once the respondent has interacted with it. Each
 * card below is here for one specific unscanned state, and the spec asserts it
 * actually reached that state before scanning (a no-op must not pass as clean).
 *
 * | Card                        | State axe has never seen                                         |
 * | --------------------------- | ---------------------------------------------------------------- |
 * | `date`                      | the SELECTED day cell (`bg-brand` + `text-primary-foreground`)   |
 * | `cta` with `buttonExternal` | the in-card external-link button; the kitchen sink sets it false |
 * | `fileUpload`                | the uploaded-file chip + its `Delete …` control, uploader hidden |
 * | `cal`                       | our wrapper around the scheduler — never scanned at all          |
 *
 * `fileUpload` is deliberately REQUIRED here: advancing past it is then only
 * possible if the mocked upload really registered a response, which is what makes
 * the "fully exercised" claim checkable rather than asserted.
 */
const buildAnsweredStatesQuestions = (baseURL: string) => [
  {
    id: createId(),
    type: "date",
    headline: i18nValue(DATE_HEADLINE),
    subheader: i18nValue("Pick any day that suits you."),
    required: true,
    format: "M-d-y",
  },
  {
    id: createId(),
    type: "cta",
    headline: i18nValue(CTA_EXTERNAL_HEADLINE),
    subheader: i18nValue("The guide opens in a new tab."),
    required: false,
    buttonExternal: true,
    // Same-origin on purpose: `buttonUrl` has to satisfy `isSafeLinkUrl`, and a
    // fixture must never point a click at a live external site. The transform
    // moves `buttonLabel` to `ctaButtonLabel`, which is what the button renders.
    buttonUrl: new URL("/", baseURL).toString(),
    buttonLabel: i18nValue(CTA_EXTERNAL_BUTTON_LABEL),
  },
  {
    id: createId(),
    type: "fileUpload",
    headline: i18nValue(FILE_UPLOAD_HEADLINE),
    required: true,
    allowMultipleFiles: false,
  },
  {
    id: createId(),
    type: "cal",
    headline: i18nValue(CAL_HEADLINE),
    subheader: i18nValue("Any 30 minute slot works."),
    // Optional because a real booking is impossible here: the only value the
    // element ever writes is "booked", and that comes from Cal's own iframe.
    required: false,
    calUserName: CAL_USER_NAME,
  },
];

/**
 * Survey name of the single-language kitchen-sink fixture. The public survey exposes it as its
 * one top-level `<h1>` (ENG-2336), so the heading-structure spec asserts against it.
 */
export const A11Y_SURVEY_NAME = "A11y Kitchen Sink";

/** Survey name of the answered-states fixture, exposed as that survey's one `<h1>`. */
export const A11Y_ANSWERED_STATES_SURVEY_NAME = "A11y Answered States";

/** Welcome-card headline, exposed as an `<h2>` like every other card headline. */
export const WELCOME_CARD_HEADLINE = "Welcome to our feedback survey";

/** Headline of the first (open text) question — an `<h2>` wrapping a real `<label>`. */
export const OPEN_TEXT_HEADLINE = "What feedback do you have for us?";

/** Headline of the single-select question, which names its radiogroup via aria-labelledby. */
export const SINGLE_SELECT_HEADLINE = "Which plan are you on?";

/**
 * Headlines of the answered-states cards. The spec walks that survey by headline rather than by
 * card index so reordering the fixture cannot silently point a scan at the wrong card.
 */
export const DATE_HEADLINE = "Which day works best for you?";
export const CTA_EXTERNAL_HEADLINE = "Read the setup guide";
export const FILE_UPLOAD_HEADLINE = "Attach a screenshot of the problem";
export const CAL_HEADLINE = "Book a call with our team";

/**
 * Label of the CTA card's in-card external-link button. The transform renames the legacy
 * `buttonLabel` to `ctaButtonLabel`, which is the field that button renders from — so this is
 * also the assertion that the rename still holds.
 */
export const CTA_EXTERNAL_BUTTON_LABEL = "Open the setup guide";

/**
 * Cal.com handle for the scheduler fixture. Deliberately not a real one: the spec aborts every
 * request to `CAL_EMBED_ORIGIN` so the third-party snippet never loads, never resolves this
 * handle, and never injects its iframe. Only the wrapper around it is ours to scan.
 */
export const CAL_USER_NAME = "formbricks-a11y-fixture/30min";

/**
 * Origin the Cal.com embed snippet is fetched from (see packages/surveys cal-embed.tsx). The spec
 * blocks it, so the unattended axe run stays free of external network and of markup we do not own.
 */
export const CAL_EMBED_ORIGIN = "cal.com";

const buildWelcomeCard = () => ({
  enabled: true,
  headline: i18nValue(WELCOME_CARD_HEADLINE),
  subheader: i18nValue("It only takes a minute."),
  timeToFinish: true,
  showResponseCount: false,
});

/**
 * Ending-card headline, exported so the spec can positively detect survey completion via the
 * rendered `<h2>` (the ending card carries no dedicated DOM hook of its own).
 */
export const ENDING_CARD_HEADLINE = "Thank you!";

const buildEndings = () => [
  {
    id: createId(),
    type: "endScreen" as const,
    headline: i18nValue(ENDING_CARD_HEADLINE),
    subheader: i18nValue("We appreciate your feedback."),
  },
];

/** The two fixture question lists this file can create a survey from. */
type FixtureQuestionList =
  | ReturnType<typeof buildKitchenSinkQuestions>
  | ReturnType<typeof buildAnsweredStatesQuestions>;

/**
 * Creates a published link survey directly through Prisma from a legacy `questions`
 * list. The list is converted to blocks with the same transform the v1 management
 * API applies server-side, so the stored shape cannot drift from the API contract.
 */
const createLinkSurvey = async (
  workspaceId: string,
  createdBy: string,
  name: string,
  questionList: FixtureQuestionList
): Promise<string> => {
  const questions = questionList as unknown as TLegacyQuestions;
  const endings = buildEndings() as unknown as TSurveyEnding[];
  const blocks = transformQuestionsToBlocks(questions, endings);

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name,
      type: "link",
      status: "inProgress",
      welcomeCard: buildWelcomeCard() as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });
  return survey.id;
};

/**
 * Adds an English (default) + Arabic (enabled) language to an already-created
 * survey and patches Arabic translations into its stored blocks. Done via Prisma
 * because the language relation is keyed by a real `Language.id` that must already
 * exist in the workspace.
 */
const attachArabicLanguage = async (surveyId: string, workspaceId: string): Promise<void> => {
  // Canonical BCP-47 codes (post language-code canonicalization, PR #8390): stored
  // language codes are canonical (`ar-EG`), and survey content i18n keys must match
  // the stored code exactly.
  const [english, arabic] = await Promise.all([
    prisma.language.upsert({
      where: { workspaceId_code: { workspaceId, code: "en-US" } },
      update: {},
      create: { id: createId(), code: "en-US", workspaceId },
    }),
    prisma.language.upsert({
      where: { workspaceId_code: { workspaceId, code: "ar-EG" } },
      update: {},
      create: { id: createId(), code: "ar-EG", workspaceId },
    }),
  ]);

  await prisma.surveyLanguage.createMany({
    data: [
      { surveyId, languageId: english.id, default: true, enabled: true },
      { surveyId, languageId: arabic.id, default: false, enabled: true },
    ],
    skipDuplicates: true,
  });

  // Patch Arabic translations into every label-bearing field of every block element
  // (headline, subheader, placeholder, rating lower/upper labels, choice / matrix
  // row / matrix column labels) so axe scans real RTL text everywhere. Falls back to
  // the default text for keys we do not translate; rendering direction is driven by
  // the `ar` code regardless.
  const survey = await prisma.survey.findUnique({ where: { id: surveyId }, select: { blocks: true } });
  const blocks = (survey?.blocks ?? []) as Prisma.JsonValue[];

  const localize = (value: unknown): unknown => {
    if (value && typeof value === "object" && "default" in (value as Record<string, unknown>)) {
      const i18n = value as Record<string, string>;
      return { ...i18n, "ar-EG": `${i18n.default} (مرحبا)` };
    }
    return value;
  };

  // Fields on an element that hold a single i18n string.
  const I18N_FIELDS = ["headline", "subheader", "placeholder", "lowerLabel", "upperLabel", "buttonLabel"];
  // Fields on an element that hold arrays of `{ label: i18n }` entries.
  const I18N_LIST_FIELDS = ["choices", "rows", "columns"];

  const localizeList = (list: unknown[]): unknown[] =>
    list.map((item) => {
      if (!item || typeof item !== "object") return item;
      const entry = { ...(item as Record<string, unknown>) };
      if (entry.label) entry.label = localize(entry.label);
      return entry;
    });

  const patchedBlocks = blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    const elements = Array.isArray(b.elements) ? b.elements : [];
    const patchedElements = elements.map((element) => {
      if (!element || typeof element !== "object") return element;
      const e = { ...(element as Record<string, unknown>) };
      for (const field of I18N_FIELDS) {
        if (e[field]) e[field] = localize(e[field]);
      }
      for (const field of I18N_LIST_FIELDS) {
        if (Array.isArray(e[field])) e[field] = localizeList(e[field] as unknown[]);
      }
      return e;
    });
    return { ...b, elements: patchedElements };
  });

  await prisma.survey.update({
    where: { id: surveyId },
    data: { blocks: patchedBlocks as Prisma.InputJsonValue[], showLanguageSwitch: true },
  });
};

export interface SeededAccessibilitySurveys {
  workspaceId: string;
  /** Published single-language kitchen-sink survey link, e.g. `/s/<id>`. */
  surveyUrl: string;
  /** Published multi-language kitchen-sink survey link forced to Arabic, e.g. `/s/<id>?lang=ar-EG`. */
  rtlSurveyUrl: string;
  /** Published answered-states survey link (date / external CTA / file upload / cal), e.g. `/s/<id>`. */
  answeredStatesSurveyUrl: string;
}

/**
 * Seeds a workspace user plus three published link surveys — the kitchen sink, its
 * Arabic RTL twin, and the answered-states fixture — entirely through Prisma, with
 * no login or dashboard interaction, and returns their public `/s/<id>` links.
 */
export const seedAccessibilitySurveys = async (
  users: UsersFixture,
  baseURL: string
): Promise<SeededAccessibilitySurveys> => {
  const user = await users.create({ skipSurveySeed: true });
  const workspaceId = user.workspaceId;
  if (!workspaceId) {
    throw new Error("users.create() did not return a workspaceId");
  }

  const [mainSurveyId, rtlSurveyId, answeredStatesSurveyId] = await Promise.all([
    createLinkSurvey(workspaceId, user.id, A11Y_SURVEY_NAME, buildKitchenSinkQuestions(baseURL)),
    createLinkSurvey(workspaceId, user.id, `${A11Y_SURVEY_NAME} (RTL)`, buildKitchenSinkQuestions(baseURL)),
    createLinkSurvey(
      workspaceId,
      user.id,
      A11Y_ANSWERED_STATES_SURVEY_NAME,
      buildAnsweredStatesQuestions(baseURL)
    ),
  ]);
  await attachArabicLanguage(rtlSurveyId, workspaceId);

  return {
    workspaceId,
    surveyUrl: `/s/${mainSurveyId}`,
    rtlSurveyUrl: `/s/${rtlSurveyId}?lang=ar-EG`,
    answeredStatesSurveyUrl: `/s/${answeredStatesSurveyId}`,
  };
};
