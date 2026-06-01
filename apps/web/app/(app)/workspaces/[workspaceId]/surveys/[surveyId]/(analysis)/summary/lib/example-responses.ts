import "server-only";
import { z } from "zod";
import { type TResponseData, type TResponseInput, type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { ZUserEmail } from "@formbricks/types/user";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getLocalizedValue } from "@/lib/i18n/utils";

export const EXAMPLE_RESPONSE_COUNT = 10;
// Impression-only displays simulate respondents who saw the survey but didn't
// submit. Combined with the response count, the dashboard's completion rate
// lands around 62% — close to typical web survey benchmarks.
export const EXAMPLE_IMPRESSION_ONLY_COUNT = 6;
export const EXAMPLE_AI_GENERATED_TAG_NAME = "AI-generated example response";

// ~20% of synthetic responses are partial drop-offs to mirror typical survey
// abandonment. The remaining ~80% are finished.
const DROP_OFF_RATE = 0.2;
const RESPONSE_TIME_SPREAD_DAYS = 10;

// Realistic distributions for synthetic response metadata. Weighted toward
// common values so charts don't look uniformly random.
const META_BROWSERS = ["Chrome", "Chrome", "Chrome", "Safari", "Safari", "Firefox", "Edge"];
const META_DEVICES = ["desktop", "desktop", "desktop", "mobile", "mobile", "tablet"];
const META_OS = ["macOS", "Windows", "Windows", "iOS", "iOS", "Android", "Linux"];
const META_COUNTRIES = ["US", "US", "DE", "GB", "FR", "IN", "BR", "JP", "CA", "AU", "NL", "ES"];

// Rough ms-per-element bands used to fabricate per-element TTC. Mirrors what
// real respondents take so the analytics page's avg-time-per-question chart
// looks plausible. Values are intentionally coarse — we only need shape, not
// fidelity.
const TTC_BANDS_MS: Partial<Record<TSurveyElementTypeEnum, [number, number]>> = {
  [TSurveyElementTypeEnum.OpenText]: [8000, 30000],
  [TSurveyElementTypeEnum.MultipleChoiceSingle]: [2000, 7000],
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: [4000, 12000],
  [TSurveyElementTypeEnum.Rating]: [2000, 5000],
  [TSurveyElementTypeEnum.NPS]: [2500, 6000],
  [TSurveyElementTypeEnum.CSAT]: [2000, 5000],
  [TSurveyElementTypeEnum.CES]: [3000, 7000],
  [TSurveyElementTypeEnum.Date]: [3000, 8000],
  [TSurveyElementTypeEnum.Ranking]: [8000, 20000],
  [TSurveyElementTypeEnum.Matrix]: [6000, 18000],
  [TSurveyElementTypeEnum.Address]: [15000, 45000],
  [TSurveyElementTypeEnum.ContactInfo]: [10000, 30000],
  [TSurveyElementTypeEnum.PictureSelection]: [3000, 9000],
  [TSurveyElementTypeEnum.Consent]: [2000, 5000],
};
const DEFAULT_TTC_BAND_MS: [number, number] = [3000, 10000];

const pickFrom = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomIntInclusive = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const SUPPORTED_ELEMENT_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.Date,
  TSurveyElementTypeEnum.Ranking,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.ContactInfo,
  TSurveyElementTypeEnum.PictureSelection,
  TSurveyElementTypeEnum.Consent,
]);

const DEFAULT_LANGUAGE = "default";

// Wire format for Address/ContactInfo responses is a fixed-length string array;
// hidden fields contribute empty strings at their position. Order must match
// `convertToValueArray` in the respective survey-runtime elements.
const ADDRESS_FIELD_ORDER = ["addressLine1", "addressLine2", "city", "state", "zip", "country"] as const;
const CONTACT_INFO_FIELD_ORDER = ["firstName", "lastName", "email", "phone", "company"] as const;

type TAddressField = (typeof ADDRESS_FIELD_ORDER)[number];
type TContactInfoField = (typeof CONTACT_INFO_FIELD_ORDER)[number];

// Modern surveys store this in `survey.blocks[].elements`; `survey.questions`
// is the v1-compat field and may be empty. Walk both, de-dupe by id.
const collectSurveyElements = (survey: TSurvey): TSurveyElement[] => {
  const byId = new Map<string, TSurveyElement>();
  for (const block of survey.blocks ?? []) {
    for (const element of block.elements ?? []) {
      byId.set(element.id, element);
    }
  }
  for (const question of survey.questions ?? []) {
    if (!byId.has(question.id)) byId.set(question.id, question as unknown as TSurveyElement);
  }
  return [...byId.values()];
};

const labelsForChoices = (
  element: Extract<
    TSurveyElement,
    {
      type:
        | TSurveyElementTypeEnum.MultipleChoiceSingle
        | TSurveyElementTypeEnum.MultipleChoiceMulti
        | TSurveyElementTypeEnum.Ranking;
    }
  >
): string[] => element.choices.map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE)).filter(Boolean);

const answerSchemaForElement = (element: TSurveyElement): z.ZodTypeAny | null => {
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      return z.string().min(1).describe("A realistic free-text answer for this question.");
    case TSurveyElementTypeEnum.Rating: {
      const range = element.range ?? 5;
      return z.number().int().min(1).max(range).describe(`Rating from 1 to ${range}.`);
    }
    case TSurveyElementTypeEnum.NPS:
      return z.number().int().min(0).max(10).describe("NPS score from 0 (detractor) to 10 (promoter).");
    case TSurveyElementTypeEnum.Consent:
      // Real consent responses only ever store the literal "accepted"; dismissal
      // is inferred from ttc presence, which synthetic rows don't carry, so this
      // bucket realistically reflects accepted respondents only.
      return z.literal("accepted").describe("Always the literal string 'accepted'.");
    case TSurveyElementTypeEnum.CSAT: {
      // CSAT range is fixed to 5 by the element schema, but read defensively.
      const range = element.range ?? 5;
      return z.number().int().min(1).max(range).describe(`CSAT rating from 1 to ${range}.`);
    }
    case TSurveyElementTypeEnum.CES: {
      const range = element.range;
      return z.number().int().min(1).max(range).describe(`CES score from 1 to ${range}.`);
    }
    case TSurveyElementTypeEnum.Date:
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO date format YYYY-MM-DD")
        .describe("ISO date (YYYY-MM-DD) within the last 12 months.");
    case TSurveyElementTypeEnum.MultipleChoiceSingle: {
      const labels = labelsForChoices(element);
      if (labels.length === 0) return null;
      return z
        .enum(labels as [string, ...string[]])
        .describe("Pick exactly one of the listed choices, copying its label verbatim.");
    }
    case TSurveyElementTypeEnum.MultipleChoiceMulti: {
      const labels = labelsForChoices(element);
      if (labels.length === 0) return null;
      return z
        .array(z.enum(labels as [string, ...string[]]))
        .min(1)
        .max(labels.length)
        .describe("One or more choice labels copied verbatim from the listed choices.");
    }
    case TSurveyElementTypeEnum.Ranking: {
      const labels = labelsForChoices(element);
      if (labels.length === 0) return null;
      return z
        .array(z.enum(labels as [string, ...string[]]))
        .length(labels.length)
        .refine((arr) => new Set(arr).size === arr.length, {
          message: "Ranking must be a permutation of all choices (no duplicates).",
        })
        .describe(
          `Rank all ${labels.length} choices from most to least preferred. Use each choice label exactly once, copied verbatim.`
        );
    }
    case TSurveyElementTypeEnum.Matrix: {
      const rowLabels = element.rows.map((r) => getLocalizedValue(r.label, DEFAULT_LANGUAGE)).filter(Boolean);
      const columnLabels = element.columns
        .map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE))
        .filter(Boolean);
      if (rowLabels.length === 0 || columnLabels.length === 0) return null;

      const rowShape = Object.fromEntries(
        rowLabels.map((row) => [row, z.enum(columnLabels as [string, ...string[]])])
      );
      return z
        .object(rowShape)
        .describe("Object keyed by each row label; each value is exactly one column label copied verbatim.");
    }
    case TSurveyElementTypeEnum.Address: {
      const shownFields = ADDRESS_FIELD_ORDER.filter((f) => element[f].show);
      if (shownFields.length === 0) return null;
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const field of shownFields) {
        shape[field] = element[field].required ? z.string().min(1) : z.string().optional();
      }
      return z
        .object(shape)
        .describe(
          "Plausible synthetic address values for the listed fields. Use realistic-but-clearly-fictional values."
        );
    }
    case TSurveyElementTypeEnum.PictureSelection: {
      // PictureSelection responses store choice IDs, not image URLs. The LLM
      // can't see images, so it picks IDs blindly — we just need a plausible
      // distribution to populate the analytics chart.
      const ids = element.choices.map((c) => c.id);
      if (ids.length === 0) return null;
      const idEnum = z.enum(ids as [string, ...string[]]);
      const max = element.allowMulti ? ids.length : 1;
      return z
        .array(idEnum)
        .min(1)
        .max(max)
        .refine((arr) => new Set(arr).size === arr.length, {
          message: "PictureSelection answers must not repeat the same choice id.",
        })
        .describe(
          element.allowMulti
            ? `Pick between 1 and ${ids.length} choice ids from the listed picture options (no duplicates).`
            : "Pick exactly one choice id from the listed picture options."
        );
    }
    case TSurveyElementTypeEnum.ContactInfo: {
      const shownFields = CONTACT_INFO_FIELD_ORDER.filter((f) => element[f].show);
      if (shownFields.length === 0) return null;
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const field of shownFields) {
        const base = field === "email" ? ZUserEmail : z.string().min(1);
        shape[field] = element[field].required ? base : base.optional();
      }
      return z
        .object(shape)
        .describe(
          "Plausible synthetic contact info — invented names, example.com emails, fake phone numbers. Never use real people."
        );
    }
    default:
      return null;
  }
};

// Some element types use a different wire format than the LLM-friendly schema
// shape (Address/ContactInfo store fixed-length arrays). Map LLM output to the
// shape the analytics dashboard expects.
const transformAnswerForElement = (element: TSurveyElement, value: unknown): unknown => {
  switch (element.type) {
    case TSurveyElementTypeEnum.Address: {
      if (typeof value !== "object" || value === null) return undefined;
      const obj = value as Partial<Record<TAddressField, string>>;
      return ADDRESS_FIELD_ORDER.map((f) => obj[f] ?? "");
    }
    case TSurveyElementTypeEnum.ContactInfo: {
      if (typeof value !== "object" || value === null) return undefined;
      const obj = value as Partial<Record<TContactInfoField, string>>;
      return CONTACT_INFO_FIELD_ORDER.map((f) => obj[f] ?? "");
    }
    default:
      return value;
  }
};

export type TExampleResponseSchemaContext = {
  supportedElementIds: string[];
};

export const buildExampleResponsesSchema = (
  survey: TSurvey
): { schema: z.ZodTypeAny; ctx: TExampleResponseSchemaContext } => {
  const perElementEntries: [string, z.ZodTypeAny][] = [];
  for (const el of collectSurveyElements(survey)) {
    if (!SUPPORTED_ELEMENT_TYPES.has(el.type)) continue;
    const answerSchema = answerSchemaForElement(el);
    if (!answerSchema) continue;
    perElementEntries.push([el.id, el.required ? answerSchema : answerSchema.optional()]);
  }

  const oneResponse = z.object(Object.fromEntries(perElementEntries));
  const schema = z.object({
    responses: z.array(oneResponse).length(EXAMPLE_RESPONSE_COUNT),
  });

  return { schema, ctx: { supportedElementIds: perElementEntries.map(([id]) => id) } };
};

const buildLlmContext = (survey: TSurvey, supportedElementIds: Set<string>) => {
  const elements = collectSurveyElements(survey)
    .filter((el) => supportedElementIds.has(el.id))
    .map((el) => {
      const headline = getLocalizedValue(el.headline, DEFAULT_LANGUAGE);
      const subheader = getLocalizedValue(el.subheader, DEFAULT_LANGUAGE);
      const base: Record<string, unknown> = {
        id: el.id,
        type: el.type,
        headline,
        subheader: subheader || undefined,
        required: el.required,
      };
      if (
        el.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
        el.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
        el.type === TSurveyElementTypeEnum.Ranking
      ) {
        base.choices = labelsForChoices(el);
      }
      if (el.type === TSurveyElementTypeEnum.Rating || el.type === TSurveyElementTypeEnum.CES) {
        base.scale = el.scale;
        base.range = el.range;
      }
      if (el.type === TSurveyElementTypeEnum.CSAT) {
        base.scale = el.scale;
        base.range = el.range;
      }
      if (el.type === TSurveyElementTypeEnum.Date) {
        base.displayFormat = el.format;
      }
      if (el.type === TSurveyElementTypeEnum.Matrix) {
        base.rows = el.rows.map((r) => getLocalizedValue(r.label, DEFAULT_LANGUAGE)).filter(Boolean);
        base.columns = el.columns.map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE)).filter(Boolean);
      }
      if (el.type === TSurveyElementTypeEnum.Address) {
        base.shownFields = ADDRESS_FIELD_ORDER.filter((f) => el[f].show);
        base.requiredFields = ADDRESS_FIELD_ORDER.filter((f) => el[f].show && el[f].required);
      }
      if (el.type === TSurveyElementTypeEnum.PictureSelection) {
        base.choiceIds = el.choices.map((c) => c.id);
        base.allowMulti = el.allowMulti;
      }
      if (el.type === TSurveyElementTypeEnum.ContactInfo) {
        base.shownFields = CONTACT_INFO_FIELD_ORDER.filter((f) => el[f].show);
        base.requiredFields = CONTACT_INFO_FIELD_ORDER.filter((f) => el[f].show && el[f].required);
      }
      return base;
    });

  return {
    surveyTitle: survey.name,
    surveyDescription: survey.welcomeCard?.headline
      ? getLocalizedValue(survey.welcomeCard.headline, DEFAULT_LANGUAGE)
      : undefined,
    elements,
  };
};

const SYSTEM_PROMPT = `You generate plausible, varied example survey responses for a Formbricks survey owner who wants to see what their analytics will look like once real respondents start answering.
Rules:
- Produce exactly the number of responses requested.
- Each response must answer every required element. Skip optional elements roughly 20% of the time to make the data realistic.
- For multiple-choice elements, copy the choice label exactly as listed; never invent new options.
- For ranking elements, return every choice label exactly once in your preferred order, copied verbatim.
- For matrix elements, return an object keyed by each row label, with one of the listed column labels as the value.
- For date elements, return an ISO date string (YYYY-MM-DD) within the last 12 months. Distribute dates across that window, not all in one day.
- For address/contact-info elements, populate only the listed fields. Use clearly-fictional but realistic values (example.com emails, fake phone numbers, invented names). Never use real people.
- For picture-selection elements, you cannot see the images — distribute selections roughly evenly across the listed choice ids; use only the ids provided, copied verbatim.
- Vary tone, length, sentiment, and choice distribution across responses so the data looks like real, diverse users — not robotic copies.

Sentiment & score distribution (real surveys skew positive):
- NPS: roughly 60% promoters (9–10), 25% passives (7–8), 15% detractors (0–6). Include at least one detractor for realism, but the bulk should sit at 8–10.
- CSAT: roughly 70% top-two scores (e.g. 4–5 on a 5-point scale), 20% middle, 10% low. Lean satisfied.
- Rating: similarly bias toward the top third of the scale (e.g. 4–5 on a 5-point, 6–7 on a 7-point). A small minority can be low.
- For free-text on dissatisfied scores, mirror the score: a low NPS or low CSAT respondent should sound frustrated. A high one should sound enthusiastic.

Free-text style — write like a real person typing on their phone, not a polished focus-group transcript:
- Vary length wildly: some answers are 2–3 words ("super useful 🙌"), some are 1 short sentence, some are 2 sentences. Avoid the same length twice in a row.
- Casual register. Start sentences with lowercase sometimes. Use sentence fragments. Drop punctuation occasionally.
- Sprinkle emojis where they'd naturally appear (🙌, 👍, 😊, ❤️, 🚀, 😅, 🤔) — not on every response, maybe 1 in 3.
- Light typos and informal contractions are fine ("def", "tbh", "rly nice", "wld love", "thx").
- Match the language of the element headline.
- No corporate buzzwords. No "I would like to commend the team for..." energy.`;

export type TGenerateExampleResponsesArgs = {
  survey: TSurvey;
  organizationId: string;
};

export type TGeneratedExampleResponse = {
  data: TResponseData;
  ttc: TResponseTtc;
  finished: boolean;
  endingId: string | null;
  language: string | null;
  meta: NonNullable<TResponseInput["meta"]>;
  createdAt: Date;
};

// Picks an enabled non-default survey language at random ~30% of the time;
// otherwise leaves it null so the response uses the survey default. Mirrors a
// real distribution where most respondents use the default language.
const pickResponseLanguage = (survey: TSurvey): string | null => {
  const enabledNonDefault = (survey.languages ?? []).filter((l) => l.enabled && !l.default);
  if (enabledNonDefault.length === 0) return null;
  if (Math.random() > 0.3) return null;
  return pickFrom(enabledNonDefault).language.code;
};

const buildResponseMeta = (): NonNullable<TResponseInput["meta"]> => ({
  source: "example-generation",
  userAgent: {
    browser: pickFrom(META_BROWSERS),
    device: pickFrom(META_DEVICES),
    os: pickFrom(META_OS),
  },
  country: pickFrom(META_COUNTRIES),
});

// Spread createdAt across the last N days, weighted slightly toward more
// recent dates so the responses-over-time chart trends upward.
const pickCreatedAt = (): Date => {
  const now = Date.now();
  const skew = Math.random() ** 1.6; // bias toward 0 → more recent
  const daysAgo = skew * RESPONSE_TIME_SPREAD_DAYS;
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000);
};

const ttcForElement = (element: TSurveyElement): number => {
  const band = TTC_BANDS_MS[element.type] ?? DEFAULT_TTC_BAND_MS;
  return randomIntInclusive(band[0], band[1]);
};

// For drop-offs we keep only answers up to (but excluding) the drop element
// and emit ttc for the same prefix. `createResponse` recomputes _total only
// when finished, so partial responses correctly show no total.
const applyDropOff = (
  data: TResponseData,
  ttc: TResponseTtc,
  orderedElementIds: string[]
): { data: TResponseData; ttc: TResponseTtc } => {
  if (orderedElementIds.length <= 1) return { data, ttc };
  const dropIndex = randomIntInclusive(1, orderedElementIds.length - 1);
  const keptIds = new Set(orderedElementIds.slice(0, dropIndex));
  const newData: TResponseData = {};
  const newTtc: TResponseTtc = {};
  for (const id of keptIds) {
    if (data[id] !== undefined) newData[id] = data[id];
    if (ttc[id] !== undefined) newTtc[id] = ttc[id];
  }
  return { data: newData, ttc: newTtc };
};

export const generateExampleResponses = async ({
  survey,
  organizationId,
}: TGenerateExampleResponsesArgs): Promise<TGeneratedExampleResponse[]> => {
  const { schema, ctx } = buildExampleResponsesSchema(survey);
  if (ctx.supportedElementIds.length === 0) {
    return [];
  }

  const supportedIds = new Set(ctx.supportedElementIds);
  const llmContext = buildLlmContext(survey, supportedIds);
  const elementsById = new Map(collectSurveyElements(survey).map((el) => [el.id, el]));
  const finishedEndingId = survey.endings?.[0]?.id ?? null;

  const { object } = await generateOrganizationAIObject<{ responses: Array<Record<string, unknown>> }>({
    organizationId,
    schema: schema as z.ZodType<{ responses: Array<Record<string, unknown>> }>,
    system: SYSTEM_PROMPT,
    prompt: `Generate ${EXAMPLE_RESPONSE_COUNT} diverse example responses for this survey.

Survey context (JSON):
${JSON.stringify(llmContext, null, 2)}`,
  });

  return object.responses.map((row: Record<string, unknown>, index: number): TGeneratedExampleResponse => {
    const data: TResponseData = {};
    const ttc: TResponseTtc = {};
    for (const id of ctx.supportedElementIds) {
      const value = row[id];
      if (value === undefined || value === null) continue;
      const element = elementsById.get(id);
      if (!element) continue;
      const transformed = transformAnswerForElement(element, value);
      if (transformed === undefined) continue;
      data[id] = transformed as TResponseData[string];
      ttc[id] = ttcForElement(element);
    }

    // Deterministically mark the first ~DROP_OFF_RATE * N responses as
    // drop-offs (here: 2 of 10). Using index instead of Math.random keeps the
    // ratio stable even with small N.
    const isFinished = index >= Math.ceil(EXAMPLE_RESPONSE_COUNT * DROP_OFF_RATE);
    const final = isFinished ? { data, ttc } : applyDropOff(data, ttc, ctx.supportedElementIds);

    return {
      data: final.data,
      ttc: final.ttc,
      finished: isFinished,
      endingId: isFinished ? finishedEndingId : null,
      language: pickResponseLanguage(survey),
      meta: buildResponseMeta(),
      createdAt: pickCreatedAt(),
    };
  });
};

export const toExampleResponseInput = (
  surveyId: string,
  workspaceId: string,
  generated: TGeneratedExampleResponse,
  displayId?: string
): TResponseInput => ({
  workspaceId,
  surveyId,
  finished: generated.finished,
  endingId: generated.endingId,
  language: generated.language ?? undefined,
  data: generated.data,
  ttc: generated.ttc,
  meta: generated.meta,
  ...(displayId ? { displayId } : {}),
});

// Builds timestamps for impression-only displays — same distribution shape as
// response createdAt so the two trends look consistent on the dashboard.
export const buildExampleImpressionTimestamps = (count: number): Date[] =>
  Array.from({ length: count }, () => pickCreatedAt());
