import { z } from "zod";
import { ZAllowedFileExtension } from "./common";
import {
  TSurveyQuestionTypeEnum,
  ZSurvey,
  ZSurveyCTALogic,
  ZSurveyCalLogic,
  ZSurveyConsentLogic,
  ZSurveyEndings,
  ZSurveyFileUploadLogic,
  ZSurveyMultipleChoiceLogic,
  ZSurveyNPSLogic,
  ZSurveyOpenTextLogic,
  ZSurveyOpenTextQuestionInputType,
  ZSurveyPictureChoice,
  ZSurveyPictureSelectionLogic,
  ZSurveyQuestionBase,
  ZSurveyRatingLogic,
} from "./surveys/types";

const ZLegacySurveyQuestionBase = ZSurveyQuestionBase.extend({
  headline: z.string(),
  subheader: z.string().optional(),
  buttonLabel: z.string().optional(),
  backButtonLabel: z.string().optional(),
});

export const ZLegacySurveyOpenTextQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.OpenText),
  placeholder: z.string().optional(),
  longAnswer: z.boolean().optional(),
  logic: z.array(ZSurveyOpenTextLogic).optional(),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
});

export type TLegacySurveyOpenTextQuestion = z.infer<typeof ZLegacySurveyOpenTextQuestion>;

export const ZLegacySurveyConsentQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Consent),
  html: z.string().optional(),
  label: z.string(),
  placeholder: z.string().optional(),
  logic: z.array(ZSurveyConsentLogic).optional(),
});

export type TLegacySurveyConsentQuestion = z.infer<typeof ZLegacySurveyConsentQuestion>;

export const ZLegacySurveyChoice = z.object({
  id: z.string(),
  label: z.string(),
});

export type TLegacySurveyChoice = z.infer<typeof ZLegacySurveyChoice>;

export const ZLegacySurveyMultipleChoiceSingleQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
  choices: z.array(ZLegacySurveyChoice),
  logic: z.array(ZSurveyMultipleChoiceLogic).optional(),
  shuffleOption: z.enum(["none", "all", "exceptLast"]).optional(),
  otherOptionPlaceholder: z.string().optional(),
});

export type TLegacySurveyMultipleChoiceSingleQuestion = z.infer<
  typeof ZLegacySurveyMultipleChoiceSingleQuestion
>;

export const ZLegacySurveyMultipleChoiceMultiQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  choices: z.array(ZLegacySurveyChoice),
  logic: z.array(ZSurveyMultipleChoiceLogic).optional(),
  shuffleOption: z.enum(["none", "all", "exceptLast"]).optional(),
  otherOptionPlaceholder: z.string().optional(),
});

export type TLegacySurveyMultipleChoiceMultiQuestion = z.infer<
  typeof ZLegacySurveyMultipleChoiceMultiQuestion
>;

export const ZLegacySurveyNPSQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.NPS),
  lowerLabel: z.string(),
  upperLabel: z.string(),
  logic: z.array(ZSurveyNPSLogic).optional(),
});

export type TLegacySurveyNPSQuestion = z.infer<typeof ZLegacySurveyNPSQuestion>;

export const ZLegacySurveyCTAQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CTA),
  html: z.string().optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: z.string().optional(),
  logic: z.array(ZSurveyCTALogic).optional(),
});

export type TLegacySurveyCTAQuestion = z.infer<typeof ZLegacySurveyCTAQuestion>;

export const ZLegacySurveyRatingQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: z.string(),
  upperLabel: z.string(),
  logic: z.array(ZSurveyRatingLogic).optional(),
});

export const ZLegacySurveyDateQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Date),
  html: z.string().optional(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"]),
});

export type TLegacySurveyDateQuestion = z.infer<typeof ZLegacySurveyDateQuestion>;

export type TLegacySurveyRatingQuestion = z.infer<typeof ZLegacySurveyRatingQuestion>;

export const ZLegacySurveyPictureSelectionQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  allowMulti: z.boolean().optional().default(false),
  choices: z.array(ZSurveyPictureChoice),
  logic: z.array(ZSurveyPictureSelectionLogic).optional(),
});

export type TLegacySurveyPictureSelectionQuestion = z.infer<typeof ZLegacySurveyPictureSelectionQuestion>;

export const ZLegacySurveyFileUploadQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
  logic: z.array(ZSurveyFileUploadLogic).optional(),
});

export type TLegacySurveyFileUploadQuestion = z.infer<typeof ZLegacySurveyFileUploadQuestion>;

export const ZLegacySurveyCalQuestion = ZLegacySurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Cal),
  calUserName: z.string(),
  calHost: z.string().optional(),
  logic: z.array(ZSurveyCalLogic).optional(),
});

export type TLegacySurveyCalQuestion = z.infer<typeof ZLegacySurveyCalQuestion>;

export const ZLegacySurveyQuestion = z.union([
  ZLegacySurveyOpenTextQuestion,
  ZLegacySurveyConsentQuestion,
  ZLegacySurveyMultipleChoiceSingleQuestion,
  ZLegacySurveyMultipleChoiceMultiQuestion,
  ZLegacySurveyNPSQuestion,
  ZLegacySurveyCTAQuestion,
  ZLegacySurveyRatingQuestion,
  ZLegacySurveyPictureSelectionQuestion,
  ZLegacySurveyDateQuestion,
  ZLegacySurveyFileUploadQuestion,
  ZLegacySurveyCalQuestion,
]);

export const ZLegacySurveyThankYouCard = z.object({
  enabled: z.boolean(),
  headline: z.string().optional(),
  subheader: z.string().optional(),
  buttonLabel: z.optional(z.string()),
  buttonLink: z.optional(z.string()),
  imageUrl: z.string().optional(),
});

export type TLegacySurveyThankYouCard = z.infer<typeof ZLegacySurveyThankYouCard>;

export const ZLegacySurveyWelcomeCard = z.object({
  enabled: z.boolean(),
  headline: z.string(),
  html: z.string().optional(),
  fileUrl: z.string().optional(),
  buttonLabel: z.string().optional(),
  timeToFinish: z.boolean().default(true),
  showResponseCount: z.boolean().default(false),
});

export type TLegacySurveyWelcomeCard = z.infer<typeof ZLegacySurveyWelcomeCard>;

export type TLegacySurveyQuestion = z.infer<typeof ZLegacySurveyQuestion>;

export const ZLegacySurveyQuestions = z.array(ZLegacySurveyQuestion);

// ZSurvey is a refinement, so to extend it to ZLegacySurvey, we need to extend the innerType and then apply the same refinements.
export const ZLegacySurvey = ZSurvey.innerType().extend({
  questions: ZLegacySurveyQuestions,
  thankYouCard: ZLegacySurveyThankYouCard,
  welcomeCard: ZLegacySurveyWelcomeCard,
  triggers: z.array(z.string()),
  endings: ZSurveyEndings.optional(),
});

export type TLegacySurvey = z.infer<typeof ZLegacySurvey>;
