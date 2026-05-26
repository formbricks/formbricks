import "server-only";
import { z } from "zod";
import { type TResponseData, type TResponseInput } from "@formbricks/types/responses";
import { type TSurvey, type TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getLocalizedValue } from "@/lib/i18n/utils";

// Number of demo responses we ask the LLM to produce. Hardcoded for v1 per
// ENG-766 to keep scope tight; revisit if there's product demand for configurability.
export const EXAMPLE_RESPONSE_COUNT = 5;

// Question types we know how to (a) build a zod answer-schema for and (b) map
// the LLM's output to TResponseData. Anything else is silently skipped — the
// demo response just won't include an answer for that question.
const SUPPORTED_QUESTION_TYPES = new Set<TSurveyQuestionTypeEnum>([
  TSurveyQuestionTypeEnum.OpenText,
  TSurveyQuestionTypeEnum.MultipleChoiceSingle,
  TSurveyQuestionTypeEnum.MultipleChoiceMulti,
  TSurveyQuestionTypeEnum.Rating,
  TSurveyQuestionTypeEnum.NPS,
]);

const DEFAULT_LANGUAGE = "default";

const labelsForChoices = (
  question: Extract<
    TSurveyQuestion,
    {
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle | TSurveyQuestionTypeEnum.MultipleChoiceMulti;
    }
  >
): string[] => question.choices.map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE)).filter(Boolean);

const answerSchemaForQuestion = (question: TSurveyQuestion): z.ZodTypeAny | null => {
  switch (question.type) {
    case TSurveyQuestionTypeEnum.OpenText:
      return z.string().min(1).describe("A realistic free-text answer for this question.");
    case TSurveyQuestionTypeEnum.Rating: {
      const range = question.range ?? 5;
      return z.number().int().min(1).max(range).describe(`Rating from 1 to ${range}.`);
    }
    case TSurveyQuestionTypeEnum.NPS:
      return z.number().int().min(0).max(10).describe("NPS score from 0 (detractor) to 10 (promoter).");
    case TSurveyQuestionTypeEnum.MultipleChoiceSingle: {
      const labels = labelsForChoices(question);
      if (labels.length === 0) return null;
      return z
        .enum(labels as [string, ...string[]])
        .describe("Pick exactly one of the listed choices, copying its label verbatim.");
    }
    case TSurveyQuestionTypeEnum.MultipleChoiceMulti: {
      const labels = labelsForChoices(question);
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
  supportedQuestionIds: string[];
};

/**
 * Builds a zod schema describing what the LLM must produce: an array of N
 * objects, each keyed by the survey's supported-question ids with the right
 * answer type per question. Anything else in the survey is omitted from the
 * schema so the LLM never wastes tokens or hallucinates fields we'd have to
 * discard.
 */
export const buildExampleResponsesSchema = (
  survey: TSurvey
): { schema: z.ZodTypeAny; ctx: TExampleResponseSchemaContext } => {
  const perQuestionEntries: [string, z.ZodTypeAny][] = [];
  for (const q of survey.questions) {
    if (!SUPPORTED_QUESTION_TYPES.has(q.type)) continue;
    const answerSchema = answerSchemaForQuestion(q);
    if (!answerSchema) continue;
    perQuestionEntries.push([q.id, q.required ? answerSchema : answerSchema.optional()]);
  }

  const oneResponse = z.object(Object.fromEntries(perQuestionEntries));
  const schema = z.object({
    responses: z.array(oneResponse).length(EXAMPLE_RESPONSE_COUNT),
  });

  return { schema, ctx: { supportedQuestionIds: perQuestionEntries.map(([id]) => id) } };
};

// Compact description fed to the LLM. We avoid sending all of `survey` —
// just the bits that inform the answer content.
const buildLlmContext = (survey: TSurvey, supportedQuestionIds: Set<string>) => {
  const questions = survey.questions
    .filter((q) => supportedQuestionIds.has(q.id))
    .map((q) => {
      const headline = getLocalizedValue(q.headline, DEFAULT_LANGUAGE);
      const subheader = getLocalizedValue(q.subheader, DEFAULT_LANGUAGE);
      const base: Record<string, unknown> = {
        id: q.id,
        type: q.type,
        headline,
        subheader: subheader || undefined,
        required: q.required,
      };
      if (
        q.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
        q.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
      ) {
        base.choices = labelsForChoices(q);
      }
      if (q.type === TSurveyQuestionTypeEnum.Rating) {
        base.scale = q.scale;
        base.range = q.range;
      }
      return base;
    });

  return {
    surveyTitle: survey.name,
    surveyDescription: survey.welcomeCard?.headline
      ? getLocalizedValue(survey.welcomeCard.headline, DEFAULT_LANGUAGE)
      : undefined,
    questions,
  };
};

const SYSTEM_PROMPT = `You generate plausible, varied example survey responses for a Formbricks survey owner who wants to see what their analytics will look like once real respondents start answering.
Rules:
- Produce exactly the number of responses requested.
- Each response must answer every required question. Skip optional questions roughly 20% of the time to make the data realistic.
- For multiple-choice questions, copy the choice label exactly as listed; never invent new options.
- Vary tone, length, sentiment, and choice distribution across responses so the data looks like real, diverse users — not robotic copies.
- For free-text questions, write short to medium answers (1–3 sentences) in the same language as the question headline.`;

export type TGenerateExampleResponsesArgs = {
  survey: TSurvey;
  organizationId: string;
};

export type TGeneratedExampleResponse = {
  data: TResponseData;
};

/**
 * Generates N example response payloads for the given survey via the org's
 * configured LLM. Returns response-data objects ready to wrap in TResponseInput
 * and persist via createResponseWithQuotaEvaluation.
 *
 * Returns an empty array if the survey has no questions we can synthesize for.
 */
export const generateExampleResponses = async ({
  survey,
  organizationId,
}: TGenerateExampleResponsesArgs): Promise<TGeneratedExampleResponse[]> => {
  const { schema, ctx } = buildExampleResponsesSchema(survey);
  if (ctx.supportedQuestionIds.length === 0) {
    return [];
  }

  const supportedIds = new Set(ctx.supportedQuestionIds);
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
    for (const id of ctx.supportedQuestionIds) {
      const value = row[id];
      if (value === undefined || value === null) continue;
      // The schema already constrained values to string | string[] | number,
      // which matches TResponseData. Cast through unknown to satisfy the
      // narrower TResponseDataValue union.
      data[id] = value as TResponseData[string];
    }
    return { data };
  });
};

// Constructs the per-response TResponseInput. Kept thin so the action can
// stamp the meta consistently across all five responses.
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
