import { z } from "zod";
import { QuestionType } from "../questions";
import { ZColor, ZSurveyPlacement } from "./common";

export const ZSurveyThankYouCard = z.object({
  enabled: z.boolean(),
  headline: z.optional(z.string()),
  subheader: z.optional(z.string()),
});

export const ZSurveyWelcomeCard = z.object({
  enabled: z.boolean(),
  headline: z.optional(z.string()),
  html: z.string().optional(),
  fileUrl: z.string().optional(),
  buttonLabel: z.string().optional(),
  timeToFinish: z.boolean().default(false),
});

export const ZSurveyHiddenFields = z.object({
  enabled: z.boolean(),
  fieldIds: z.optional(z.array(z.string())),
});

export const ZSurveyProductOverwrites = z.object({
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  placement: ZSurveyPlacement.nullish(),
  clickOutside: z.boolean().nullish(),
  darkOverlay: z.boolean().nullish(),
});

export type TSurveyProductOverwrites = z.infer<typeof ZSurveyProductOverwrites>;

export const ZSurveyClosedMessage = z
  .object({
    enabled: z.boolean().optional(),
    heading: z.string().optional(),
    subheading: z.string().optional(),
  })
  .nullable()
  .optional();

export const ZSurveySingleUse = z
  .object({
    enabled: z.boolean(),
    heading: z.optional(z.string()),
    subheading: z.optional(z.string()),
    isEncrypted: z.boolean(),
  })
  .nullable();

export type TSurveySingleUse = z.infer<typeof ZSurveySingleUse>;

export const ZSurveyVerifyEmail = z
  .object({
    name: z.optional(z.string()),
    subheading: z.optional(z.string()),
  })
  .optional();

export type TSurveyVerifyEmail = z.infer<typeof ZSurveyVerifyEmail>;

export type TSurveyWelcomeCard = z.infer<typeof ZSurveyWelcomeCard>;

export type TSurveyThankYouCard = z.infer<typeof ZSurveyThankYouCard>;

export type TSurveyHiddenFields = z.infer<typeof ZSurveyHiddenFields>;

export type TSurveyClosedMessage = z.infer<typeof ZSurveyClosedMessage>;

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
  isDraft: z.boolean().optional(),
});

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextQuestionInputType = z.infer<typeof ZSurveyOpenTextQuestionInputType>;

export const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(QuestionType.OpenText),
  placeholder: z.string().optional(),
  longAnswer: z.boolean().optional(),
  logic: z.array(ZSurveyOpenTextLogic).optional(),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
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

// export const ZSurveyWelcomeQuestion = ZSurveyQuestionBase.extend({
//   type: z.literal(QuestionType.Welcome),
//   html: z.string().optional(),
//   fileUrl: z.string().optional(),
//   buttonUrl: z.string().optional(),
//   timeToFinish: z.boolean().default(false),
//   logic: z.array(ZSurveyCTALogic).optional(),
// });

// export type TSurveyWelcomeQuestion = z.infer<typeof ZSurveyWelcomeQuestion>;

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
  // ZSurveyWelcomeQuestion,
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
  attributeClassId: z.string().cuid2(),
  condition: z.enum(["equals", "notEquals"]),
  value: z.string(),
});

export type TSurveyAttributeFilter = z.infer<typeof ZSurveyAttributeFilter>;

const ZSurveyDisplayOption = z.enum(["displayOnce", "displayMultiple", "respondMultiple"]);

export type TSurveyDisplayOption = z.infer<typeof ZSurveyDisplayOption>;

const ZSurveyType = z.enum(["web", "email", "link", "mobile"]);

export type TSurveyType = z.infer<typeof ZSurveyType>;

const ZSurveyStatus = z.enum(["draft", "inProgress", "paused", "completed"]);

export type TSurveyStatus = z.infer<typeof ZSurveyStatus>;

export const ZSurvey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  type: ZSurveyType,
  environmentId: z.string(),
  status: ZSurveyStatus,
  attributeFilters: z.array(ZSurveyAttributeFilter),
  displayOption: ZSurveyDisplayOption,
  autoClose: z.number().nullable(),
  triggers: z.array(z.string()),
  redirectUrl: z.string().url().nullable(),
  recontactDays: z.number().nullable(),
  welcomeCard: ZSurveyWelcomeCard,
  questions: ZSurveyQuestions,
  thankYouCard: ZSurveyThankYouCard,
  hiddenFields: ZSurveyHiddenFields,
  delay: z.number(),
  autoComplete: z.number().nullable(),
  closeOnDate: z.date().nullable(),
  productOverwrites: ZSurveyProductOverwrites.nullable(),
  surveyClosedMessage: ZSurveyClosedMessage.nullable(),
  singleUse: ZSurveySingleUse.nullable(),
  verifyEmail: ZSurveyVerifyEmail.nullable(),
  pin: z.number().nullable().optional(),
});

export const ZSurveyInput = z.object({
  name: z.string(),
  type: ZSurveyType.optional(),
  status: ZSurveyStatus.optional(),
  displayOption: ZSurveyDisplayOption.optional(),
  autoClose: z.number().optional(),
  redirectUrl: z.string().url().optional(),
  recontactDays: z.number().optional(),
  welcomeCard: ZSurveyWelcomeCard.optional(),
  questions: ZSurveyQuestions.optional(),
  thankYouCard: ZSurveyThankYouCard.optional(),
  hiddenFields: ZSurveyHiddenFields,
  delay: z.number().optional(),
  autoComplete: z.number().optional(),
  closeOnDate: z.date().optional(),
  surveyClosedMessage: ZSurveyClosedMessage.optional(),
  verifyEmail: ZSurveyVerifyEmail.optional(),
  attributeFilters: z.array(ZSurveyAttributeFilter).optional(),
  triggers: z.array(z.string()).optional(),
});

export type TSurvey = z.infer<typeof ZSurvey>;
export type TSurveyDates = {
  createdAt: TSurvey["createdAt"];
  updatedAt: TSurvey["updatedAt"];
  closeOnDate: TSurvey["closeOnDate"];
};
export type TSurveyInput = z.infer<typeof ZSurveyInput>;

export const ZSurveyQuestionType = z.union([
  z.literal("openText"),
  z.literal("multipleChoiceSingle"),
  z.literal("multipleChoiceMulti"),
  z.literal("nps"),
  z.literal("cta"),
  z.literal("rating"),
  z.literal("consent"),
]);

export type TSurveyQuestionType = z.infer<typeof ZSurveyQuestionType>;
