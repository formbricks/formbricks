import { createId } from "@paralleldrive/cuid2";
import { type APIRequestContext, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { SURVEYS_API_URL } from "../api/constants";
import { type UsersFixture } from "../fixtures/users";
import { loginAndGetApiKey } from "../lib/utils";

/**
 * Self-seeding helpers for the survey accessibility (axe-core) suite.
 *
 * The suite must run unattended in the normal Playwright job, so it provisions
 * its own published "kitchen-sink" link survey instead of reading a manual
 * SURVEY_URL. It follows the same path as the existing API specs:
 *   1. `loginAndGetApiKey` to obtain { workspaceId, apiKey }.
 *   2. POST a survey (legacy `questions` shape, which the v1 API transforms to
 *      blocks server-side) to `/api/v1/management/surveys`.
 *   3. PUT `{ status: "inProgress" }` to publish it — a `type: "link"` survey is
 *      created as `draft` and `/s/<id>` returns 404 until it is `inProgress`
 *      (see apps/web/modules/survey/link/components/survey-renderer.tsx).
 *   4. Derive the `/s/<id>` link from the returned `data.id`.
 *
 * The multi-language / RTL variant additionally creates a real Arabic `Language`
 * row + `SurveyLanguage` join via Prisma. The v1 API cannot accept languages over
 * JSON (its `ZSurveyLanguage`/`ZLanguage` schema requires `z.date()` createdAt /
 * updatedAt and a cuid2 id that must already exist in the workspace), so the
 * language is attached directly through the database — the same boundary the
 * `users` fixture already writes through. Arabic translation keys are patched into
 * the stored blocks so axe scans genuine RTL content; `?lang=ar` then renders the
 * survey with `dir="rtl"` (see packages/surveys/src/lib/utils.ts `isRTLLanguage`).
 */

type I18n = { default: string; [lang: string]: string };

const t = (value: string): I18n => ({ default: value });

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
    headline: t("What feedback do you have for us?"),
    subheader: t("Share anything that comes to mind."),
    placeholder: t("Type your answer here..."),
    required: true,
    inputType: "text",
    charLimit: { enabled: false },
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: t("Which plan are you on?"),
    required: true,
    choices: [
      { id: createId(), label: t("Free") },
      { id: createId(), label: t("Pro") },
      { id: createId(), label: t("Enterprise") },
    ],
  },
  {
    id: createId(),
    type: "multipleChoiceMulti",
    headline: t("Which features do you use? (select all that apply)"),
    required: true,
    choices: [
      { id: createId(), label: t("Surveys") },
      { id: createId(), label: t("Contacts") },
      { id: createId(), label: t("Integrations") },
    ],
  },
  {
    id: createId(),
    type: "rating",
    headline: t("How would you rate your experience?"),
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: t("Poor"),
    upperLabel: t("Excellent"),
  },
  {
    id: createId(),
    type: "ranking",
    headline: t("Rank these in order of importance"),
    required: true,
    choices: [
      { id: createId(), label: t("Speed") },
      { id: createId(), label: t("Reliability") },
      { id: createId(), label: t("Support") },
    ],
  },
  {
    id: createId(),
    type: "matrix",
    headline: t("How much do you agree?"),
    required: true,
    rows: [
      { id: createId(), label: t("The product is easy to use") },
      { id: createId(), label: t("Support is responsive") },
    ],
    columns: [
      { id: createId(), label: t("Agree") },
      { id: createId(), label: t("Neutral") },
      { id: createId(), label: t("Disagree") },
    ],
  },
  {
    id: createId(),
    type: "date",
    headline: t("When did you start using us?"),
    required: true,
    format: "M-d-y",
  },
  {
    id: createId(),
    type: "fileUpload",
    headline: t("Upload a screenshot (optional)"),
    required: false,
    allowMultipleFiles: false,
  },
  {
    id: createId(),
    type: "cal",
    headline: t("Book a call with us"),
    required: false,
    calUserName: "rick/get-rick-rolled",
    calHost: "cal.com",
  },
  {
    id: createId(),
    type: "pictureSelection",
    headline: t("Pick the image you prefer"),
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
    headline: t("Thanks for the detail!"),
    subheader: t("Tap continue to wrap up."),
    required: false,
    buttonExternal: false,
  },
];

const buildWelcomeCard = () => ({
  enabled: true,
  headline: t("Welcome to our feedback survey"),
  subheader: t("It only takes a minute."),
  timeToFinish: true,
  showResponseCount: false,
});

const buildEndings = () => [
  {
    id: createId(),
    type: "endScreen" as const,
    headline: t("Thank you!"),
    subheader: t("We appreciate your feedback."),
  },
];

const createSurveyViaApi = async (
  request: APIRequestContext,
  workspaceId: string,
  apiKey: string,
  name: string,
  baseURL: string
): Promise<string> => {
  const createResponse = await request.post(SURVEYS_API_URL, {
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    data: {
      workspaceId,
      type: "link",
      name,
      welcomeCard: buildWelcomeCard(),
      questions: buildKitchenSinkQuestions(baseURL),
      endings: buildEndings(),
    },
  });

  const createBody = await createResponse.json().catch(() => null);
  expect(
    createResponse.ok(),
    `Survey create failed (${createResponse.status()}): ${JSON.stringify(createBody)}`
  ).toBeTruthy();

  const surveyId = createBody?.data?.id as string | undefined;
  if (!surveyId) {
    throw new Error(`Survey create response did not include an id: ${JSON.stringify(createBody)}`);
  }
  return surveyId;
};

const publishSurveyViaApi = async (
  request: APIRequestContext,
  surveyId: string,
  apiKey: string
): Promise<void> => {
  const publishResponse = await request.put(`${SURVEYS_API_URL}/${surveyId}`, {
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    data: { status: "inProgress" },
  });
  const publishBody = await publishResponse.json().catch(() => null);
  expect(
    publishResponse.ok(),
    `Survey publish failed (${publishResponse.status()}): ${JSON.stringify(publishBody)}`
  ).toBeTruthy();
  expect(publishBody?.data?.status).toBe("inProgress");
};

/**
 * Adds an English (default) + Arabic (enabled) language to an already-created
 * survey and patches Arabic translations into its stored blocks. Done via Prisma
 * because the language relation is keyed by a real `Language.id` that must already
 * exist in the workspace.
 */
const attachArabicLanguage = async (surveyId: string, workspaceId: string): Promise<void> => {
  const [english, arabic] = await Promise.all([
    prisma.language.upsert({
      where: { workspaceId_code: { workspaceId, code: "en" } },
      update: {},
      create: { id: createId(), code: "en", workspaceId },
    }),
    prisma.language.upsert({
      where: { workspaceId_code: { workspaceId, code: "ar" } },
      update: {},
      create: { id: createId(), code: "ar", workspaceId },
    }),
  ]);

  await prisma.surveyLanguage.createMany({
    data: [
      { surveyId, languageId: english.id, default: true, enabled: true },
      { surveyId, languageId: arabic.id, default: false, enabled: true },
    ],
    skipDuplicates: true,
  });

  // Patch Arabic translations into the headline/subheader/labels of every block
  // element so axe scans real RTL text. Falls back to the default text for keys we
  // do not translate; rendering direction is driven by the `ar` code regardless.
  const survey = await prisma.survey.findUnique({ where: { id: surveyId }, select: { blocks: true } });
  const blocks = (survey?.blocks ?? []) as Prisma.JsonArray;

  const localize = (value: unknown): unknown => {
    if (value && typeof value === "object" && "default" in (value as Record<string, unknown>)) {
      const i18n = value as Record<string, string>;
      return { ...i18n, ar: `${i18n.default} (مرحبا)` };
    }
    return value;
  };

  const patchedBlocks = blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const b = block as Record<string, unknown>;
    const elements = Array.isArray(b.elements) ? b.elements : [];
    const patchedElements = elements.map((element) => {
      if (!element || typeof element !== "object") return element;
      const e = { ...(element as Record<string, unknown>) };
      if (e.headline) e.headline = localize(e.headline);
      if (e.subheader) e.subheader = localize(e.subheader);
      if (Array.isArray(e.choices)) {
        e.choices = e.choices.map((choice) => {
          if (!choice || typeof choice !== "object") return choice;
          const c = { ...(choice as Record<string, unknown>) };
          if (c.label) c.label = localize(c.label);
          return c;
        });
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
  /** Published multi-language kitchen-sink survey link forced to Arabic, e.g. `/s/<id>?lang=ar`. */
  rtlSurveyUrl: string;
}

/**
 * Logs in, creates + publishes two kitchen-sink link surveys (one default-language,
 * one with an Arabic RTL variant) and returns their public `/s/<id>` links.
 */
export const seedAccessibilitySurveys = async (
  page: Page,
  request: APIRequestContext,
  users: UsersFixture,
  baseURL: string
): Promise<SeededAccessibilitySurveys> => {
  const { workspaceId, apiKey } = await loginAndGetApiKey(page, users);

  const mainSurveyId = await createSurveyViaApi(request, workspaceId, apiKey, "A11y Kitchen Sink", baseURL);
  await publishSurveyViaApi(request, mainSurveyId, apiKey);

  const rtlSurveyId = await createSurveyViaApi(
    request,
    workspaceId,
    apiKey,
    "A11y Kitchen Sink (RTL)",
    baseURL
  );
  await publishSurveyViaApi(request, rtlSurveyId, apiKey);
  await attachArabicLanguage(rtlSurveyId, workspaceId);

  return {
    workspaceId,
    surveyUrl: `/s/${mainSurveyId}`,
    rtlSurveyUrl: `/s/${rtlSurveyId}?lang=ar`,
  };
};
