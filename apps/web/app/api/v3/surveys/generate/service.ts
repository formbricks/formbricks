import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { type TV3SurveyPrepareResult, prepareV3SurveyCreateInput } from "../prepare";
import { DEFAULT_V3_SURVEY_LANGUAGE, type TV3CreateSurveyBody, formatV3ZodInvalidParams } from "../schemas";
import {
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH,
  V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS,
} from "./constants";
import { buildV3SurveyGenerationPrompt, buildV3SurveyGenerationSystemPrompt } from "./prompt";
import {
  type TGeneratedSurveyDraft,
  type TGeneratedSurveyElement,
  type TV3SurveyGenerateBody,
  V3_SURVEY_GENERATE_ALLOWED_LOCALES,
  ZGeneratedSurveyDraft,
  ZGeneratedSurveyDraftForAI,
} from "./schemas";

type TV3SurveyGenerateValidation = {
  valid: boolean;
  invalid_params: InvalidParam[];
  languages: Array<{ code: string; default: boolean; enabled: boolean }>;
};

export type TV3SurveyGenerateResult = {
  language: string;
  payload: TV3CreateSurveyBody;
  validation: TV3SurveyGenerateValidation;
};

const V3_SURVEY_GENERATION_TIMEOUT_MS = 45_000;

export class V3SurveyGeneratePromptError extends Error {
  invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super("Prompt needs more detail");
    this.name = "V3SurveyGeneratePromptError";
    this.invalidParams = invalidParams;
  }
}

export class V3SurveyGeneratedPayloadValidationError extends Error {
  invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super(
      invalidParams.length > 0
        ? `Generated survey payload is invalid: ${invalidParams
            .map((param) => `${param.name}: ${param.reason}`)
            .join("; ")}`
        : "Generated survey payload is invalid"
    );
    this.name = "V3SurveyGeneratedPayloadValidationError";
    this.invalidParams = invalidParams;
  }
}

function text(value: string, language: string): Record<string, string> {
  return { [language]: value.trim() };
}

function getPromptInvalidParams(prompt: string): InvalidParam[] {
  const normalizedPrompt = prompt.trim();
  const wordCount = normalizedPrompt.split(/\s+/).filter(Boolean).length;

  if (
    normalizedPrompt.length >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_LENGTH &&
    wordCount >= V3_SURVEY_GENERATE_PROMPT_DETAIL_MIN_WORDS
  ) {
    return [];
  }

  return [
    {
      name: "prompt",
      reason:
        "Describe the survey goal, audience, or topic in a sentence so the AI can create a useful draft.",
    },
  ];
}

function createChoice(
  label: string,
  index: number,
  language: string
): { id: string; label: Record<string, string> } {
  return createLabeledItem("choice", label, index, language);
}

function createLabeledItem(
  prefix: string,
  label: string,
  index: number,
  language: string
): { id: string; label: Record<string, string> } {
  return {
    id: `${prefix}_${index + 1}`,
    label: text(label, language),
  };
}

function translatedField<TName extends string>(
  name: TName,
  value: string | null | undefined,
  language: string
): Partial<Record<TName, Record<string, string>>> {
  if (!value) {
    return {};
  }

  return { [name]: text(value, language) } as Record<TName, Record<string, string>>;
}

function buildBaseElement(element: TGeneratedSurveyElement, index: number, language: string) {
  return {
    id: `q_${index + 1}_${createId().slice(0, 8)}`,
    headline: text(element.headline, language),
    ...translatedField("subheader", element.subheader, language),
    required: element.required,
    isDraft: true,
  };
}

type TBaseElement = ReturnType<typeof buildBaseElement>;

function buildOpenTextElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: "openText" as const,
    ...translatedField("placeholder", element.placeholder, language),
    longAnswer: element.longAnswer ?? false,
    inputType: "text" as const,
    charLimit: { enabled: false },
  };
}

function buildChoiceElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: element.type as "multipleChoiceSingle" | "multipleChoiceMulti",
    choices: (element.choices ?? []).map((choice, choiceIndex) =>
      createChoice(choice, choiceIndex, language)
    ),
    shuffleOption: "none" as const,
    displayType: "list" as const,
  };
}

function buildRankingElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: "ranking" as const,
    choices: (element.choices ?? []).map((choice, choiceIndex) =>
      createChoice(choice, choiceIndex, language)
    ),
    shuffleOption: "none" as const,
  };
}

function buildMatrixElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: "matrix" as const,
    rows: (element.rows ?? []).map((row, rowIndex) => createLabeledItem("row", row, rowIndex, language)),
    columns: (element.columns ?? []).map((column, columnIndex) =>
      createLabeledItem("column", column, columnIndex, language)
    ),
    shuffleOption: "none" as const,
  };
}

function buildScaleLabels(element: TGeneratedSurveyElement, language: string) {
  return {
    ...translatedField("lowerLabel", element.lowerLabel, language),
    ...translatedField("upperLabel", element.upperLabel, language),
  };
}

function getSatisfactionQuestionRange(element: TGeneratedSurveyElement): 5 | 7 | 10 {
  if (element.range) {
    return element.range;
  }

  if (element.type === "ces") {
    return 7;
  }

  return 5;
}

function buildNpsElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: "nps" as const,
    ...buildScaleLabels(element, language),
    isColorCodingEnabled: false,
  };
}

function buildSatisfactionElement(
  baseElement: TBaseElement,
  element: TGeneratedSurveyElement,
  language: string
) {
  return {
    ...baseElement,
    type: element.type as "csat" | "ces",
    scale: element.scale ?? "number",
    range: getSatisfactionQuestionRange(element),
    ...buildScaleLabels(element, language),
    isColorCodingEnabled: false,
  };
}

function buildRatingElement(baseElement: TBaseElement, element: TGeneratedSurveyElement, language: string) {
  return {
    ...baseElement,
    type: "rating" as const,
    scale: element.scale ?? "number",
    range: element.range ?? 5,
    ...buildScaleLabels(element, language),
    isColorCodingEnabled: false,
  };
}

function buildElement(element: TGeneratedSurveyElement, index: number, language: string) {
  const baseElement = buildBaseElement(element, index, language);

  switch (element.type) {
    case "openText":
      return buildOpenTextElement(baseElement, element, language);
    case "multipleChoiceSingle":
    case "multipleChoiceMulti":
      return buildChoiceElement(baseElement, element, language);
    case "ranking":
      return buildRankingElement(baseElement, element, language);
    case "matrix":
      return buildMatrixElement(baseElement, element, language);
    case "date":
      return { ...baseElement, type: "date" as const, format: element.format ?? "M-d-y" };
    case "nps":
      return buildNpsElement(baseElement, element, language);
    case "csat":
    case "ces":
      return buildSatisfactionElement(baseElement, element, language);
    default:
      return buildRatingElement(baseElement, element, language);
  }
}

const RATING_LIKE_GENERATED_ELEMENT_TYPES = new Set<TGeneratedSurveyElement["type"]>([
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Ranking,
]);

function isRatingLikeGeneratedElement(element: TGeneratedSurveyElement): boolean {
  return RATING_LIKE_GENERATED_ELEMENT_TYPES.has(element.type);
}

function normalizeGeneratedSurveyBlocks(generatedSurvey: TGeneratedSurveyDraft): TGeneratedSurveyDraft {
  return {
    ...generatedSurvey,
    blocks: generatedSurvey.blocks.flatMap((block) => {
      if (block.questions.length === 1) {
        return [block];
      }

      const normalizedBlocks: TGeneratedSurveyDraft["blocks"] = [];
      let pendingNonRatingQuestions: TGeneratedSurveyElement[] = [];

      const flushPendingNonRatingQuestions = () => {
        if (pendingNonRatingQuestions.length === 0) {
          return;
        }

        normalizedBlocks.push({
          name: block.name,
          questions: pendingNonRatingQuestions,
        });
        pendingNonRatingQuestions = [];
      };

      block.questions.forEach((question) => {
        if (!isRatingLikeGeneratedElement(question)) {
          pendingNonRatingQuestions.push(question);
          return;
        }

        flushPendingNonRatingQuestions();
        normalizedBlocks.push({
          name: question.headline,
          questions: [question],
        });
      });

      flushPendingNonRatingQuestions();

      return normalizedBlocks;
    }),
  };
}

function buildCreatePayload(input: TV3SurveyGenerateBody, generatedSurvey: TGeneratedSurveyDraft): unknown {
  const welcomeCard = generatedSurvey.welcomeCard;
  const welcomeHeadline = welcomeCard?.headline ?? generatedSurvey.name;
  const language = generatedSurvey.language;
  let questionIndex = 0;

  return {
    workspaceId: input.workspaceId,
    type: input.type,
    name: generatedSurvey.name,
    status: "draft",
    defaultLanguage: language,
    languages: [{ code: language, default: true, enabled: true }],
    metadata: {
      title: text(generatedSurvey.name, language),
      ...(generatedSurvey.description ? { description: text(generatedSurvey.description, language) } : {}),
    },
    welcomeCard:
      welcomeCard?.enabled === true
        ? {
            enabled: true,
            headline: text(welcomeHeadline, language),
            ...(welcomeCard.subheader ? { subheader: text(welcomeCard.subheader, language) } : {}),
            buttonLabel: text(welcomeCard.buttonLabel ?? "Start", language),
            timeToFinish: true,
            showResponseCount: false,
          }
        : { enabled: false },
    blocks: generatedSurvey.blocks.map((block) => ({
      id: createId(),
      name: block.name,
      elements: block.questions.map((element) => buildElement(element, questionIndex++, language)),
    })),
    endings: [
      {
        id: createId(),
        type: "endScreen",
        headline: text(generatedSurvey.ending?.headline ?? "Thanks for your feedback", language),
        ...(generatedSurvey.ending?.subheader
          ? { subheader: text(generatedSurvey.ending.subheader, language) }
          : {}),
      },
    ],
    hiddenFields: { enabled: false },
    variables: [],
  };
}

function serializeValidation(
  preparation: Extract<TV3SurveyPrepareResult<TV3CreateSurveyBody>, { ok: true }>
): TV3SurveyGenerateValidation {
  return {
    valid: true,
    invalid_params: [],
    languages: preparation.languageRequests,
  };
}

export async function generateV3SurveyCreatePayloadFromPrompt(params: {
  organizationId: string;
  input: TV3SurveyGenerateBody;
}): Promise<TV3SurveyGenerateResult> {
  const invalidParams = getPromptInvalidParams(params.input.prompt);

  if (invalidParams.length > 0) {
    throw new V3SurveyGeneratePromptError(invalidParams);
  }

  const generation = await generateOrganizationAIObject({
    organizationId: params.organizationId,
    schema: ZGeneratedSurveyDraftForAI,
    schemaName: "FormbricksSurveyDraft",
    schemaDescription: "A concise Formbricks survey draft that can be converted to a v3 create payload.",
    system: buildV3SurveyGenerationSystemPrompt(V3_SURVEY_GENERATE_ALLOWED_LOCALES, params.input.type),
    prompt: buildV3SurveyGenerationPrompt(
      params.input.prompt,
      params.input.type,
      params.input.language ?? DEFAULT_V3_SURVEY_LANGUAGE,
      V3_SURVEY_GENERATE_ALLOWED_LOCALES
    ),
    temperature: 0.2,
    maxOutputTokens: 3000,
    timeout: V3_SURVEY_GENERATION_TIMEOUT_MS,
  });

  const generatedSurvey = ZGeneratedSurveyDraft.safeParse(generation.object);
  if (!generatedSurvey.success) {
    throw new V3SurveyGeneratedPayloadValidationError(
      formatV3ZodInvalidParams(generatedSurvey.error, "generatedSurvey")
    );
  }

  const normalizedGeneratedSurvey = normalizeGeneratedSurveyBlocks(generatedSurvey.data);
  const createPayload = buildCreatePayload(params.input, normalizedGeneratedSurvey);
  const preparation = prepareV3SurveyCreateInput(createPayload);
  if (!preparation.ok) {
    throw new V3SurveyGeneratedPayloadValidationError(preparation.validation.invalidParams);
  }

  return {
    language: normalizedGeneratedSurvey.language,
    payload: createPayload as TV3CreateSurveyBody,
    validation: serializeValidation(preparation),
  };
}
