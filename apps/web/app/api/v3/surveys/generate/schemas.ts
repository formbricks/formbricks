import { z } from "zod";
import { normalizeV3SurveyLanguageTag } from "../language";
import {
  GENERATED_SURVEY_MAX_BLOCKS,
  GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  GENERATED_SURVEY_MIN_BLOCKS,
  GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK,
  V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
} from "./constants";

const ZV3SurveyGenerateLanguage = z
  .string()
  .trim()
  .min(1, "Language code is required")
  .transform((value, ctx) => {
    const normalizedLanguage = normalizeV3SurveyLanguageTag(value);

    if (!normalizedLanguage) {
      ctx.addIssue({
        code: "custom",
        message: `Language '${value}' is not a valid language code`,
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
      .min(1, "Prompt is required")
      .max(
        V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH,
        `Prompt must be ${V3_SURVEY_GENERATE_PROMPT_MAX_LENGTH} characters or less`
      ),
    type: z.literal("link").prefault("link"),
    language: ZV3SurveyGenerateLanguage.optional(),
  })
  .strict();

const ZGeneratedText = z.string().trim().min(1).max(220);
const ZGeneratedDescription = z.string().trim().min(1).max(320);
const ZGeneratedChoice = z.string().trim().min(1).max(80);

const ZGeneratedSurveyElement = z
  .object({
    type: z.enum(["openText", "multipleChoiceSingle", "multipleChoiceMulti", "nps", "rating"]),
    headline: ZGeneratedText,
    subheader: ZGeneratedDescription.nullable(),
    required: z.boolean(),
    placeholder: z.string().trim().min(1).max(120).nullable(),
    longAnswer: z.boolean().nullable(),
    choices: z.array(ZGeneratedChoice).min(2).max(6).nullable(),
    lowerLabel: z.string().trim().min(1).max(60).nullable(),
    upperLabel: z.string().trim().min(1).max(60).nullable(),
    scale: z.enum(["number", "smiley", "star"]).nullable(),
    range: z.union([z.literal(5), z.literal(7), z.literal(10)]).nullable(),
  })
  .strict()
  .superRefine((element, ctx) => {
    if (
      (element.type === "multipleChoiceSingle" || element.type === "multipleChoiceMulti") &&
      !element.choices
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice questions must include choices",
      });
    }
  });

const ZGeneratedSurveyBlock = z
  .object({
    name: ZGeneratedText,
    questions: z
      .array(ZGeneratedSurveyElement)
      .min(GENERATED_SURVEY_MIN_QUESTIONS_PER_BLOCK)
      .max(GENERATED_SURVEY_MAX_QUESTIONS_PER_BLOCK),
  })
  .strict();

export const ZGeneratedSurveyDraft = z
  .object({
    language: ZV3SurveyGenerateLanguage,
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
    blocks: z.array(ZGeneratedSurveyBlock).min(GENERATED_SURVEY_MIN_BLOCKS).max(GENERATED_SURVEY_MAX_BLOCKS),
    ending: z
      .object({
        headline: ZGeneratedText.nullable(),
        subheader: ZGeneratedDescription.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type TV3SurveyGenerateBody = z.infer<typeof ZV3SurveyGenerateBody>;
export type TGeneratedSurveyDraft = z.infer<typeof ZGeneratedSurveyDraft>;
export type TGeneratedSurveyElement = z.infer<typeof ZGeneratedSurveyElement>;
