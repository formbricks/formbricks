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
]);

const DEFAULT_LANGUAGE = "default";

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
      type: TSurveyElementTypeEnum.MultipleChoiceSingle | TSurveyElementTypeEnum.MultipleChoiceMulti;
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
    default:
      return null;
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
        el.type === TSurveyElementTypeEnum.MultipleChoiceMulti
      ) {
        base.choices = labelsForChoices(el);
      }
      if (el.type === TSurveyElementTypeEnum.Rating) {
        base.scale = el.scale;
        base.range = el.range;
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
      data[id] = value as TResponseData[string];
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
