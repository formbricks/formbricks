import "server-only";
import { z } from "zod";
import { type TResponseData, type TResponseInput } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getLocalizedValue } from "@/lib/i18n/utils";

export const EXAMPLE_RESPONSE_COUNT = 5;

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
        const base = field === "email" ? z.string().email() : z.string().min(1);
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
- For free-text elements, write short to medium answers (1–3 sentences) in the same language as the element headline.`;

export type TGenerateExampleResponsesArgs = {
  survey: TSurvey;
  organizationId: string;
};

export type TGeneratedExampleResponse = {
  data: TResponseData;
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

  const { object } = await generateOrganizationAIObject<{ responses: Array<Record<string, unknown>> }>({
    organizationId,
    schema: schema as z.ZodType<{ responses: Array<Record<string, unknown>> }>,
    system: SYSTEM_PROMPT,
    prompt: `Generate ${EXAMPLE_RESPONSE_COUNT} diverse example responses for this survey.

Survey context (JSON):
${JSON.stringify(llmContext, null, 2)}`,
  });

  return object.responses.map((row) => {
    const data: TResponseData = {};
    for (const id of ctx.supportedElementIds) {
      const value = row[id];
      if (value === undefined || value === null) continue;
      const element = elementsById.get(id);
      if (!element) continue;
      const transformed = transformAnswerForElement(element, value);
      if (transformed === undefined) continue;
      data[id] = transformed as TResponseData[string];
    }
    return { data };
  });
};

export const toExampleResponseInput = (
  surveyId: string,
  workspaceId: string,
  generated: TGeneratedExampleResponse
): TResponseInput => ({
  workspaceId,
  surveyId,
  finished: true,
  data: generated.data,
  meta: {
    source: "example-generation",
  },
});
