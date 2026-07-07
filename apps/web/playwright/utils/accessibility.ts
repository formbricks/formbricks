import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding, type TSurveyQuestion } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { type UsersFixture } from "../fixtures/users";

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
    headline: i18nValue("What feedback do you have for us?"),
    subheader: i18nValue("Share anything that comes to mind."),
    placeholder: i18nValue("Type your answer here..."),
    required: true,
    inputType: "text",
    charLimit: { enabled: false },
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: i18nValue("Which plan are you on?"),
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

const buildWelcomeCard = () => ({
  enabled: true,
  headline: i18nValue("Welcome to our feedback survey"),
  subheader: i18nValue("It only takes a minute."),
  timeToFinish: true,
  showResponseCount: false,
});

/**
 * Ending-card headline, exported so the spec can positively detect survey completion
 * via the rendered `<h1>` (the ending card no longer carries a dedicated DOM hook).
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

/**
 * Creates a published kitchen-sink link survey directly through Prisma. The legacy
 * `questions` list is converted to blocks with the same transform the v1 management
 * API applies server-side, so the stored shape cannot drift from the API contract.
 */
const createKitchenSinkSurvey = async (
  workspaceId: string,
  createdBy: string,
  name: string,
  baseURL: string
): Promise<string> => {
  const questions = buildKitchenSinkQuestions(baseURL) as unknown as TSurveyQuestion[];
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
}

/**
 * Seeds a workspace user plus two published kitchen-sink link surveys (one
 * default-language, one with an Arabic RTL variant) entirely through Prisma —
 * no login or dashboard interaction — and returns their public `/s/<id>` links.
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

  const [mainSurveyId, rtlSurveyId] = await Promise.all([
    createKitchenSinkSurvey(workspaceId, user.id, "A11y Kitchen Sink", baseURL),
    createKitchenSinkSurvey(workspaceId, user.id, "A11y Kitchen Sink (RTL)", baseURL),
  ]);
  await attachArabicLanguage(rtlSurveyId, workspaceId);

  return {
    workspaceId,
    surveyUrl: `/s/${mainSurveyId}`,
    rtlSurveyUrl: `/s/${rtlSurveyId}?lang=ar-EG`,
  };
};
