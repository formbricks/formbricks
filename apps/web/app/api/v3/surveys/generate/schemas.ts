import { z } from "zod";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { SURVEY_RUNTIME_LANGUAGE_CODES } from "@formbricks/i18n-utils/survey-runtime-languages";
import { ZUserLocale } from "@formbricks/types/user";
import {
  GENERATED_SURVEY_ELEMENT_TYPES,
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
  V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
  V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH,
} from "./constants";

/**
 * The languages AI survey creation can write a draft in: every language the survey runtime ships
 * strings for, plus the dashboard locales (`pt-PT` is one the runtime serves from `pt-BR`).
 *
 * Not the dashboard locales alone. Which language the survey is authored in is about the respondents,
 * not about the language the author's dashboard happens to be in — capping it to `ZUserLocale` is what
 * made a Korean draft impossible (ENG-3882). Not every BCP-47 tag either: outside this set the runtime
 * has no button or validation strings, so the draft would ship English chrome (ENG-2325).
 */
export const V3_SURVEY_GENERATE_ALLOWED_LANGUAGES = [
  ...new Set<string>([...SURVEY_RUNTIME_LANGUAGE_CODES, ...ZUserLocale.options]),
].sort((left, right) => left.localeCompare(right)) as [string, ...string[]];
export const ZV3SurveyGenerateAllowedLanguage = z.enum(V3_SURVEY_GENERATE_ALLOWED_LANGUAGES);

const ALLOWED_GENERATE_LANGUAGE_LOOKUP = new Map<string, string>(
  V3_SURVEY_GENERATE_ALLOWED_LANGUAGES.map((language) => [language.toLowerCase(), language] as const)
);

export function normalizeV3SurveyGenerateLanguage(value: string): string | null {
  const normalizedLanguage = normalizeLanguageCode(value);

  if (!normalizedLanguage) {
    return null;
  }

  return ALLOWED_GENERATE_LANGUAGE_LOOKUP.get(normalizedLanguage.toLowerCase()) ?? null;
}

const ZV3SurveyGenerateLanguage = z
  .string()
  .trim()
  .min(1, "Language code is required")
  .transform((value, ctx) => {
    const normalizedLanguage = normalizeV3SurveyGenerateLanguage(value);

    if (!normalizedLanguage) {
      ctx.addIssue({
        code: "custom",
        message: `Language '${value}' is not supported for AI survey creation`,
      });
      return z.NEVER;
    }

    return normalizedLanguage;
  });

export const ZV3SurveyGenerateBody = z
  .object({
    workspaceId: z.cuid2(),
    prompt: z
      .string()
      .trim()
      .min(
        V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH,
        `Prompt must be at least ${V3_SURVEY_GENERATE_PROMPT_MIN_LENGTH} characters`
      )
      .max(
        V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
        `Prompt must be ${V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH} characters or less`
      ),
    type: z.enum(["link", "app"]).prefault("link"),
    /** Preferred language: used only when the language of the prompt itself is unclear. */
    language: ZV3SurveyGenerateLanguage.optional(),
    /** Required language: the draft is written in it whatever language the prompt is in. */
    surveyLanguage: ZV3SurveyGenerateLanguage.optional(),
  })
  .strict();

const ZGeneratedText = z.string().trim().min(1).max(220);
const ZGeneratedDescription = z.string().trim().min(1).max(320);
const ZGeneratedChoice = z.string().trim().min(1).max(80);
const ZGeneratedChoiceList = z.array(ZGeneratedChoice).min(2).max(8);
const ZGeneratedRatingRangeForAI = z.enum(["5", "7", "10"]);
const ZGeneratedRatingRange = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  ZGeneratedRatingRangeForAI.transform((value) => Number(value) as 5 | 7 | 10)
);

const generatedSurveyElementShape = {
  type: z.enum(GENERATED_SURVEY_ELEMENT_TYPES),
  headline: ZGeneratedText,
  subheader: ZGeneratedDescription.nullable(),
  required: z.boolean(),
  placeholder: z.string().trim().min(1).max(120).nullable(),
  longAnswer: z.boolean().nullable(),
  choices: ZGeneratedChoiceList.nullable(),
  rows: ZGeneratedChoiceList.nullable().optional(),
  columns: ZGeneratedChoiceList.nullable().optional(),
  lowerLabel: z.string().trim().min(1).max(60).nullable(),
  upperLabel: z.string().trim().min(1).max(60).nullable(),
  scale: z.enum(["number", "smiley", "star"]).nullable(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"]).nullable().optional(),
} as const;

function validateGeneratedSurveyElement(
  element: {
    type: string;
    choices: string[] | null;
    rows?: string[] | null;
    columns?: string[] | null;
    range?: string | number | null;
  },
  ctx: z.RefinementCtx
): void {
  if (
    (element.type === "multipleChoiceSingle" ||
      element.type === "multipleChoiceMulti" ||
      element.type === "ranking") &&
    !element.choices
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["choices"],
      message: "Choice questions must include choices",
    });
  }

  if (element.type === "matrix") {
    if (!element.rows) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Matrix questions must include rows",
      });
    }

    if (!element.columns) {
      ctx.addIssue({
        code: "custom",
        path: ["columns"],
        message: "Matrix questions must include columns",
      });
    }
  }

  if (element.type === "csat" && element.range !== "5" && element.range !== 5) {
    ctx.addIssue({
      code: "custom",
      path: ["range"],
      message: "CSAT questions must use a range of 5",
    });
  }

  if (
    element.type === "ces" &&
    element.range !== "5" &&
    element.range !== 5 &&
    element.range !== "7" &&
    element.range !== 7
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["range"],
      message: "CES questions must use a range of 5 or 7",
    });
  }
}

export const ZGeneratedSurveyElementForAI = z
  .object({
    ...generatedSurveyElementShape,
    range: ZGeneratedRatingRangeForAI.nullable(),
  })
  .strict()
  .superRefine(validateGeneratedSurveyElement);

const ZGeneratedSurveyElement = z
  .object({
    ...generatedSurveyElementShape,
    range: ZGeneratedRatingRange.nullable(),
  })
  .strict()
  .superRefine(validateGeneratedSurveyElement);

const ZGeneratedSurveyBlockForAI = z
  .object({
    name: ZGeneratedText,
    questions: z
      .array(ZGeneratedSurveyElementForAI)
      .min(GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK)
      .max(GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK),
  })
  .strict();

const ZGeneratedSurveyBlock = z
  .object({
    name: ZGeneratedText,
    questions: z
      .array(ZGeneratedSurveyElement)
      .min(GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK)
      .max(GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK),
  })
  .strict();

const generatedSurveyDraftShape = {
  language: ZV3SurveyGenerateAllowedLanguage,
  name: ZGeneratedText,
  description: ZGeneratedDescription.nullable(),
  welcomeCard: z
    .object({
      enabled: z.boolean(),
      headline: ZGeneratedText.nullable(),
      subheader: ZGeneratedDescription.nullable(),
      buttonLabel: ZGeneratedText.nullable(),
    })
    .strict()
    .nullable(),
  ending: z
    .object({
      headline: ZGeneratedText.nullable(),
      subheader: ZGeneratedDescription.nullable(),
    })
    .strict()
    .nullable(),
} as const;

const createGeneratedSurveyDraftForAISchema = (languages: readonly [string, ...string[]]) =>
  z
    .object({
      ...generatedSurveyDraftShape,
      language: z.enum(languages),
      blocks: z
        .array(ZGeneratedSurveyBlockForAI)
        .min(GENERATED_SURVEY_MIN_BLOCKS)
        .max(GENERATED_SURVEY_MAX_BLOCKS),
    })
    .strict();

export const ZGeneratedSurveyDraftForAI = createGeneratedSurveyDraftForAISchema(
  V3_SURVEY_GENERATE_ALLOWED_LANGUAGES
);

/**
 * The provider-facing schema for one request. A required `surveyLanguage` narrows the language enum to
 * that one code, so a provider with structured output cannot return anything else; a model without it
 * is still caught afterwards by `buildV3SurveyCreatePayloadFromDraft`.
 */
export const getGeneratedSurveyDraftForAISchema = (surveyLanguage?: string) =>
  surveyLanguage ? createGeneratedSurveyDraftForAISchema([surveyLanguage]) : ZGeneratedSurveyDraftForAI;

export const ZGeneratedSurveyDraft = z
  .object({
    ...generatedSurveyDraftShape,
    blocks: z.array(ZGeneratedSurveyBlock).min(GENERATED_SURVEY_MIN_BLOCKS).max(GENERATED_SURVEY_MAX_BLOCKS),
  })
  .strict();

export type TV3SurveyGenerateBody = z.infer<typeof ZV3SurveyGenerateBody>;
export type TGeneratedSurveyDraft = z.infer<typeof ZGeneratedSurveyDraft>;
export type TGeneratedSurveyElement = z.infer<typeof ZGeneratedSurveyElement>;
