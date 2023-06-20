import { z } from "zod";
import { ZEventClass } from "./eventClasses";
import { QuestionType } from "../questions";

export const ZSurveyThankYouCard = z.object({
  enabled: z.boolean(),
  headline: z.optional(z.string()),
  subheader: z.optional(z.string()),
});

export type TSurveyThankYouCard = z.infer<typeof ZSurveyThankYouCard>;

export const ZSurveyChoice = z.object({
  id: z.string(),
  label: z.string(),
});

export const ZSurveyLogicCondition = z.union([
  z.literal("submitted"),
  z.literal("skipped"),
  z.literal("equals"),
  z.literal("notEquals"),
  z.literal("lessThan"),
  z.literal("lessEqual"),
  z.literal("greaterThan"),
  z.literal("greaterEqual"),
  z.literal("includesAll"),
  z.literal("includesOne"),
]);

export const ZSurveyLogicBase = z.object({
  condition: ZSurveyLogicCondition.optional(),
  value: z.union([z.number(), z.string(), z.array(z.string())]).optional(),
  destination: z.union([z.string(), z.literal("end")]).optional(),
});

export const ZSurveyOpenTextLogic = ZSurveyLogicBase.extend({
  condition: z.union([z.literal("submitted"), z.literal("skipped")]).optional(),
  value: z.undefined(),
});

export const ZSurveyConsentLogic = ZSurveyLogicBase.extend({
  condition: z.union([z.literal("submitted"), z.literal("skipped"), z.literal("accepted")]).optional(),
  value: z.undefined(),
});

export const ZSurveyMultipleChoiceSingleLogic = ZSurveyLogicBase.extend({
  condition: z
    .union([z.literal("submitted"), z.literal("skipped"), z.literal("equals"), z.literal("notEquals")])
    .optional(),
  value: z.string(),
});

export const ZSurveyMultipleChoiceMultiLogic = ZSurveyLogicBase.extend({
  condition: z
    .union([z.literal("submitted"), z.literal("skipped"), z.literal("includesAll"), z.literal("includesOne")])
    .optional(),
  value: z.array(z.string()),
});

export const ZSurveyNPSLogic = ZSurveyLogicBase.extend({
  condition: z
    .union([
      z.literal("submitted"),
      z.literal("skipped"),
      z.literal("lessThan"),
      z.literal("lessEqual"),
      z.literal("greaterThan"),
      z.literal("greaterEqual"),
      z.literal("equals"),
      z.literal("notEquals"),
    ])
    .optional(),
  value: z.number(),
});

const ZSurveyCTALogic = ZSurveyLogicBase.extend({
  condition: z.union([z.literal("submitted"), z.literal("skipped")]).optional(),
  value: z.undefined(),
});

const ZSurveyRatingLogic = ZSurveyLogicBase.extend({
  condition: z
    .union([
      z.literal("submitted"),
      z.literal("skipped"),
      z.literal("lessThan"),
      z.literal("lessEqual"),
      z.literal("greaterThan"),
      z.literal("greaterEqual"),
      z.literal("equals"),
      z.literal("notEquals"),
    ])
    .optional(),
  value: z.number(),
});

export const ZSurveyLogic = z.union([
  ZSurveyOpenTextLogic,
  ZSurveyConsentLogic,
  ZSurveyMultipleChoiceSingleLogic,
  ZSurveyMultipleChoiceMultiLogic,
  ZSurveyNPSLogic,
  ZSurveyCTALogic,
  ZSurveyRatingLogic,
]);

const ZSurveyQuestionBase = z.object({
  id: z.string(),
  type: z.string(),
  headline: z.string(),
  subheader: z.string().optional(),
  required: z.boolean(),
  buttonLabel: z.string().optional(),
  logic: z.array(ZSurveyLogic).optional(),
});

export const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.OpenText),
  placeholder: z.string().optional(),
});

export const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.Consent),
  placeholder: z.string().optional(),
});

export const ZSurveyMultipleChoiceSingleQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.MultipleChoiceSingle),
  choices: z.array(ZSurveyChoice),
});

export const ZSurveyMultipleChoiceMultiQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.MultipleChoiceMulti),
  choices: z.array(ZSurveyChoice),
});

export const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.NPS),
  lowerLabel: z.string(),
  upperLabel: z.string(),
});

export const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.CTA),
  html: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: z.string().optional(),
});

export const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.Rating),
  scale: z.union([z.literal("number"), z.literal("smiley"), z.literal("star")]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: z.string(),
  upperLabel: z.string(),
});

export const ZSurveyQuestion = z.union([
  ZSurveyOpenTextQuestion,
  ZSurveyConsentQuestion,
  ZSurveyMultipleChoiceSingleQuestion,
  ZSurveyMultipleChoiceMultiQuestion,
  ZSurveyNPSQuestion,
  ZSurveyCTAQuestion,
  ZSurveyRatingQuestion,
]);

export const ZSurveyQuestions = z.array(ZSurveyQuestion);

export type TSurveyQuestions = z.infer<typeof ZSurveyQuestions>;

export const ZSurveyAttributeFilter = z.object({
  id: z.string().cuid2(),
  attributeClassId: z.string(),
  condition: z.enum(["equals", "notEquals"]),
  value: z.string(),
});

export const ZSurvey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  type: z.union([z.literal("web"), z.literal("email"), z.literal("link"), z.literal("mobile")]),
  environmentId: z.string(),
  status: z.union([
    z.literal("draft"),
    z.literal("inProgress"),
    z.literal("archived"),
    z.literal("paused"),
    z.literal("completed"),
  ]),
  attributeFilters: z.array(ZSurveyAttributeFilter),
  displayOption: z.union([
    z.literal("displayOnce"),
    z.literal("displayMultiple"),
    z.literal("respondMultiple"),
  ]),
  autoClose: z.union([z.number(), z.null()]),
  triggers: z.array(ZEventClass),
  recontactDays: z.union([z.number(), z.null()]),
  questions: ZSurveyQuestions,
  thankYouCard: ZSurveyThankYouCard,
  analytics: z.object({
    numDisplays: z.number(),
    responseRate: z.number(),
  }),
});

export type TSurvey = z.infer<typeof ZSurvey>;
