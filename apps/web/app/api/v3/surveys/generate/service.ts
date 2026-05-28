import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { type TV3SurveyPrepareResult, prepareV3SurveyCreateInput } from "../prepare";
import { DEFAULT_V3_SURVEY_LANGUAGE, type TV3CreateSurveyBody, formatV3ZodInvalidParams } from "../schemas";
import { V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH } from "./constants";
import { buildV3SurveyGenerationPrompt, buildV3SurveyGenerationSystemPrompt } from "./prompt";
import {
  type TGeneratedSurveyDraft,
  type TGeneratedSurveyElement,
  type TV3SurveyGenerateBody,
  ZGeneratedSurveyDraft,
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

  if (normalizedPrompt.length >= V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH && wordCount >= 4) {
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
  return {
    id: `choice_${index + 1}`,
    label: text(label, language),
  };
}

function buildElement(element: TGeneratedSurveyElement, index: number, language: string) {
  const baseElement = {
    id: `q_${index + 1}_${createId().slice(0, 8)}`,
    headline: text(element.headline, language),
    ...(element.subheader ? { subheader: text(element.subheader, language) } : {}),
    required: element.required,
    isDraft: true,
  };

  if (element.type === "openText") {
    return {
      ...baseElement,
      type: "openText" as const,
      ...(element.placeholder ? { placeholder: text(element.placeholder, language) } : {}),
      longAnswer: element.longAnswer ?? false,
      inputType: "text" as const,
      charLimit: { enabled: false },
    };
  }

  if (element.type === "multipleChoiceSingle" || element.type === "multipleChoiceMulti") {
    return {
      ...baseElement,
      type: element.type,
      choices: (element.choices ?? []).map((choice, choiceIndex) =>
        createChoice(choice, choiceIndex, language)
      ),
      shuffleOption: "none" as const,
      displayType: "list" as const,
    };
  }

  if (element.type === "nps") {
    return {
      ...baseElement,
      type: "nps" as const,
      ...(element.lowerLabel ? { lowerLabel: text(element.lowerLabel, language) } : {}),
      ...(element.upperLabel ? { upperLabel: text(element.upperLabel, language) } : {}),
      isColorCodingEnabled: false,
    };
  }

  return {
    ...baseElement,
    type: "rating" as const,
    scale: element.scale ?? "number",
    range: element.range ?? 5,
    ...(element.lowerLabel ? { lowerLabel: text(element.lowerLabel, language) } : {}),
    ...(element.upperLabel ? { upperLabel: text(element.upperLabel, language) } : {}),
    isColorCodingEnabled: false,
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

  const generation = await generateOrganizationAIObject<TGeneratedSurveyDraft>({
    organizationId: params.organizationId,
    schema: ZGeneratedSurveyDraft,
    schemaName: "FormbricksSurveyDraft",
    schemaDescription: "A concise Formbricks survey draft that can be converted to a v3 create payload.",
    system: buildV3SurveyGenerationSystemPrompt(),
    prompt: buildV3SurveyGenerationPrompt(
      params.input.prompt,
      params.input.language ?? DEFAULT_V3_SURVEY_LANGUAGE
    ),
    temperature: 0.2,
    maxOutputTokens: 3000,
  });

  const generatedSurvey = ZGeneratedSurveyDraft.safeParse(generation.object);
  if (!generatedSurvey.success) {
    throw new V3SurveyGeneratedPayloadValidationError(
      formatV3ZodInvalidParams(generatedSurvey.error, "generatedSurvey")
    );
  }

  const createPayload = buildCreatePayload(params.input, generatedSurvey.data);
  const preparation = prepareV3SurveyCreateInput(createPayload);
  if (!preparation.ok) {
    throw new V3SurveyGeneratedPayloadValidationError(preparation.validation.invalidParams);
  }

  return {
    language: generatedSurvey.data.language,
    payload: createPayload as TV3CreateSurveyBody,
    validation: serializeValidation(preparation),
  };
}
