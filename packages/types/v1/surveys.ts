import { z } from "zod";
import { ZActionClass } from "./actionClasses";
import { QuestionType } from "../questions";

export const ZSurveyThankYouCard = z.object({
  enabled: z.boolean(),
  headline: z.optional(z.string()),
  subheader: z.optional(z.string()),
});

export const ZSurveyClosedMessage = z
  .object({
    heading: z.optional(z.string()),
    subheading: z.optional(z.string()),
  })
  .optional();

export const ZSurveyVerifyEmail = z
  .object({
    name: z.optional(z.string()),
    subheading: z.optional(z.string()),
  })
  .optional();

export type TSurveyVerifyEmail = z.infer<typeof ZSurveyVerifyEmail>;

export type TSurveyThankYouCard = z.infer<typeof ZSurveyThankYouCard>;

export type TSurveyClosedMessage = z.infer<typeof ZSurveyThankYouCard>;

export const ZSurveyChoice = z.object({
  id: z.string(),
  label: z.string(),
});

export type TSurveyChoice = z.infer<typeof ZSurveyChoice>;

export const ZSurveyLogicCondition = z.enum([
  "submitted",
  "skipped",
  "equals",
  "notEquals",
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "includesAll",
  "includesOne",
]);

export const ZSurveyLogicBase = z.object({
  condition: ZSurveyLogicCondition.optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  destination: z.union([z.string(), z.literal("end")]).optional(),
});

export const ZSurveyOpenTextLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped"]).optional(),
  value: z.undefined(),
});

export const ZSurveyConsentLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["skipped", "accepted"]).optional(),
  value: z.undefined(),
});

export const ZSurveyMultipleChoiceSingleLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped", "equals", "notEquals"]).optional(),
  value: z.string().optional(),
});

export const ZSurveyMultipleChoiceMultiLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped", "includesAll", "includesOne", "equals"]).optional(),
  value: z.union([z.array(z.string()), z.string()]).optional(),
});

export const ZSurveyNPSLogic = ZSurveyLogicBase.extend({
  condition: z
    .enum([
      "equals",
      "notEquals",
      "lessThan",
      "lessEqual",
      "greaterThan",
      "greaterEqual",
      "submitted",
      "skipped",
    ])
    .optional(),
  value: z.union([z.string(), z.number()]).optional(),
});

const ZSurveyCTALogic = ZSurveyLogicBase.extend({
  // "submitted" condition is legacy and should be removed later
  condition: z.enum(["clicked", "submitted", "skipped"]).optional(),
  value: z.undefined(),
});

const ZSurveyRatingLogic = ZSurveyLogicBase.extend({
  condition: z
    .enum([
      "equals",
      "notEquals",
      "lessThan",
      "lessEqual",
      "greaterThan",
      "greaterEqual",
      "submitted",
      "skipped",
    ])
    .optional(),
  value: z.union([z.string(), z.number()]).optional(),
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

export type TSurveyLogic = z.infer<typeof ZSurveyLogic>;

const ZSurveyQuestionBase = z.object({
  id: z.string(),
  type: z.string(),
  headline: z.string(),
  subheader: z.string().optional(),
  required: z.boolean(),
  buttonLabel: z.string().optional(),
  backButtonLabel: z.string().optional(),
  scale: z.enum(["number", "smiley", "star"]).optional(),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]).optional(),
  logic: z.array(ZSurveyLogic).optional(),
});

export const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.OpenText),
  placeholder: z.string().optional(),
  longAnswer: z.boolean().optional(),
  logic: z.array(ZSurveyOpenTextLogic).optional(),
});

export type TSurveyOpenTextQuestion = z.infer<typeof ZSurveyOpenTextQuestion>;

export const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.Consent),
  html: z.string().optional(),
  label: z.string(),
  dismissButtonLabel: z.string().optional(),
  placeholder: z.string().optional(),
  logic: z.array(ZSurveyConsentLogic).optional(),
});

export type TSurveyConsentQuestion = z.infer<typeof ZSurveyConsentQuestion>;

export const ZSurveyMultipleChoiceSingleQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.MultipleChoiceSingle),
  choices: z.array(ZSurveyChoice),
  logic: z.array(ZSurveyMultipleChoiceSingleLogic).optional(),
  shuffleOption: z.enum(["none", "all", "exceptLast"]).optional(),
});

export type TSurveyMultipleChoiceSingleQuestion = z.infer<typeof ZSurveyMultipleChoiceSingleQuestion>;

export const ZSurveyMultipleChoiceMultiQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.MultipleChoiceMulti),
  choices: z.array(ZSurveyChoice),
  logic: z.array(ZSurveyMultipleChoiceMultiLogic).optional(),
  shuffleOption: z.enum(["none", "all", "exceptLast"]).optional(),
});

export type TSurveyMultipleChoiceMultiQuestion = z.infer<typeof ZSurveyMultipleChoiceMultiQuestion>;

export const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.NPS),
  lowerLabel: z.string(),
  upperLabel: z.string(),
  logic: z.array(ZSurveyNPSLogic).optional(),
});

export type TSurveyNPSQuestion = z.infer<typeof ZSurveyNPSQuestion>;

export const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.CTA),
  html: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: z.string().optional(),
  logic: z.array(ZSurveyCTALogic).optional(),
});

export type TSurveyCTAQuestion = z.infer<typeof ZSurveyCTAQuestion>;

export const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: z.string(),
  upperLabel: z.string(),
  logic: z.array(ZSurveyRatingLogic).optional(),
});

export type TSurveyRatingQuestion = z.infer<typeof ZSurveyRatingQuestion>;

export const ZSurveyQuestion = z.union([
  ZSurveyOpenTextQuestion,
  ZSurveyConsentQuestion,
  ZSurveyMultipleChoiceSingleQuestion,
  ZSurveyMultipleChoiceMultiQuestion,
  ZSurveyNPSQuestion,
  ZSurveyCTAQuestion,
  ZSurveyRatingQuestion,
]);

export type TSurveyQuestion = z.infer<typeof ZSurveyQuestion>;

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
  type: z.enum(["web", "email", "link", "mobile"]),
  environmentId: z.string(),
  status: z.enum(["draft", "inProgress", "archived", "paused", "completed"]),
  attributeFilters: z.array(ZSurveyAttributeFilter),
  displayOption: z.enum(["displayOnce", "displayMultiple", "respondMultiple"]),
  autoClose: z.union([z.number(), z.null()]),
  triggers: z.array(ZActionClass),
  redirectUrl: z.string().url().nullable(),
  recontactDays: z.union([z.number(), z.null()]),
  questions: ZSurveyQuestions,
  thankYouCard: ZSurveyThankYouCard,
  delay: z.number(),
  autoComplete: z.union([z.number(), z.null()]),
  closeOnDate: z.date().nullable(),
  surveyClosedMessage: ZSurveyClosedMessage,
  verifyEmail: ZSurveyVerifyEmail.nullable(),
});

export type TSurvey = z.infer<typeof ZSurvey>;

export const ZSurveyWithAnalytics = ZSurvey.extend({
  analytics: z.object({
    numDisplays: z.number(),
    responseRate: z.number(),
    numResponses: z.number(),
  }),
});

export type TSurveyWithAnalytics = z.infer<typeof ZSurveyWithAnalytics>;
