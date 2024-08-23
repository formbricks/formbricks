import { z } from "zod";
import { ZActionClass, ZActionClassNoCodeConfig } from "../action-classes";
import { ZAttributes } from "../attributes";
import { ZAllowedFileExtension, ZColor, ZId, ZPlacement } from "../common";
import { ZLanguage } from "../product";
import { ZSegment } from "../segment";
import { ZBaseStyling } from "../styling";
import {
  FORBIDDEN_IDS,
  findLanguageCodesForDuplicateLabels,
  findQuestionsWithCyclicLogic,
  validateCardFieldsForAllLanguages,
  validateQuestionLabels,
} from "./validation";

export const ZI18nString = z.record(z.string()).refine((obj) => "default" in obj, {
  message: "Object must have a 'default' key",
});

export type TI18nString = z.infer<typeof ZI18nString>;

const ZSurveyEndingBase = z.object({
  id: z.string().cuid2(),
});

export const ZSurveyEndScreenCard = ZSurveyEndingBase.extend({
  type: z.literal("endScreen"),
  headline: ZI18nString.optional(),
  subheader: ZI18nString.optional(),
  buttonLabel: ZI18nString.optional(),
  buttonLink: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export type TSurveyEndScreenCard = z.infer<typeof ZSurveyEndScreenCard>;

export const ZSurveyRedirectUrlCard = ZSurveyEndingBase.extend({
  type: z.literal("redirectToUrl"),
  url: z.string().url("Invalid redirect Url in Ending card").optional(),
  label: z.string().optional(),
});

export type TSurveyRedirectUrlCard = z.infer<typeof ZSurveyRedirectUrlCard>;

export const ZSurveyEnding = z.union([ZSurveyEndScreenCard, ZSurveyRedirectUrlCard]);

export type TSurveyEnding = z.infer<typeof ZSurveyEnding>;

export const ZSurveyEndings = z.array(ZSurveyEnding);

export type TSurveyEndings = z.infer<typeof ZSurveyEndings>;

export enum TSurveyQuestionTypeEnum {
  FileUpload = "fileUpload",
  OpenText = "openText",
  MultipleChoiceSingle = "multipleChoiceSingle",
  MultipleChoiceMulti = "multipleChoiceMulti",
  NPS = "nps",
  CTA = "cta",
  Rating = "rating",
  Consent = "consent",
  PictureSelection = "pictureSelection",
  Cal = "cal",
  Date = "date",
  Matrix = "matrix",
  Address = "address",
}

export const ZSurveyQuestionId = z.string().superRefine((id, ctx) => {
  if (FORBIDDEN_IDS.includes(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Question id is not allowed`,
    });
  }

  if (id.includes(" ")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question id not allowed, avoid using spaces.",
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question id not allowed, use only alphanumeric characters, hyphens, or underscores.",
    });
  }
});

export type TSurveyQuestionId = z.infer<typeof ZSurveyQuestionId>;

export const ZSurveyWelcomeCard = z
  .object({
    enabled: z.boolean(),
    headline: ZI18nString.optional(),
    html: ZI18nString.optional(),
    fileUrl: z.string().optional(),
    buttonLabel: ZI18nString.optional(),
    timeToFinish: z.boolean().default(true),
    showResponseCount: z.boolean().default(false),
    videoUrl: z.string().optional(),
  })
  .refine((schema) => !(schema.enabled && !schema.headline), {
    message: "Welcome card must have a headline",
  });

export type TSurveyWelcomeCard = z.infer<typeof ZSurveyWelcomeCard>;

export const ZSurveyHiddenFields = z.object({
  enabled: z.boolean(),
  fieldIds: z.optional(
    z.array(
      z.string().superRefine((field, ctx) => {
        if (FORBIDDEN_IDS.includes(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Hidden field id is not allowed`,
          });
        }

        if (field.includes(" ")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hidden field id not allowed, avoid using spaces.",
          });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Hidden field id not allowed, use only alphanumeric characters, hyphens, or underscores.",
          });
        }
      })
    )
  ),
});

export type TSurveyHiddenFields = z.infer<typeof ZSurveyHiddenFields>;

export const ZSurveyVariable = z
  .discriminatedUnion("type", [
    z.object({
      id: z.string().cuid2(),
      name: z.string(),
      type: z.literal("number"),
      value: z.number().default(0),
    }),
    z.object({
      id: z.string().cuid2(),
      name: z.string(),
      type: z.literal("text"),
      value: z.string().default(""),
    }),
  ])
  .superRefine((data, ctx) => {
    // variable name can only contain lowercase letters, numbers, and underscores
    if (!/^[a-z0-9_]+$/.test(data.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variable name can only contain lowercase letters, numbers, and underscores",
        path: ["variables"],
      });
    }
  });
export const ZSurveyVariables = z.array(ZSurveyVariable);

export type TSurveyVariable = z.infer<typeof ZSurveyVariable>;
export type TSurveyVariables = z.infer<typeof ZSurveyVariables>;

export const ZSurveyProductOverwrites = z.object({
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  placement: ZPlacement.nullish(),
  clickOutsideClose: z.boolean().nullish(),
  darkOverlay: z.boolean().nullish(),
});

export type TSurveyProductOverwrites = z.infer<typeof ZSurveyProductOverwrites>;

export const ZSurveyBackgroundBgType = z.enum(["animation", "color", "upload", "image"]);

export type TSurveyBackgroundBgType = z.infer<typeof ZSurveyBackgroundBgType>;

export const ZSurveyStyling = ZBaseStyling.extend({
  overwriteThemeStyling: z.boolean().nullish(),
});

export type TSurveyStyling = z.infer<typeof ZSurveyStyling>;

export const ZSurveyClosedMessage = z
  .object({
    enabled: z.boolean().optional(),
    heading: z.string().optional(),
    subheading: z.string().optional(),
  })
  .nullable()
  .optional();

export type TSurveyClosedMessage = z.infer<typeof ZSurveyClosedMessage>;

export const ZSurveySingleUse = z
  .object({
    enabled: z.boolean(),
    heading: z.optional(z.string()),
    subheading: z.optional(z.string()),
    isEncrypted: z.boolean(),
  })
  .nullable();

export type TSurveySingleUse = z.infer<typeof ZSurveySingleUse>;

export const ZSurveyChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export const ZSurveyPictureChoice = z.object({
  id: z.string(),
  imageUrl: z.string(),
});

export type TSurveyChoice = z.infer<typeof ZSurveyChoice>;

export const ZSurveyLogicCondition = z.enum([
  "accepted",
  "clicked",
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
  "uploaded",
  "notUploaded",
  "booked",
  "isCompletelySubmitted",
  "isPartiallySubmitted",
]);

export type TSurveyLogicCondition = z.infer<typeof ZSurveyLogicCondition>;

export const ZSurveyLogicBase = z.object({
  condition: ZSurveyLogicCondition.optional(),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  destination: ZSurveyQuestionId.optional(),
});

export const ZSurveyFileUploadLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["uploaded", "notUploaded"]).optional(),
  value: z.undefined(),
});

export const ZSurveyOpenTextLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped"]).optional(),
  value: z.undefined(),
});

export const ZSurveyAddressLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped"]).optional(),
  value: z.undefined(),
});

export const ZSurveyConsentLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["skipped", "accepted"]).optional(),
  value: z.undefined(),
});

export const ZSurveyMultipleChoiceLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped", "equals", "notEquals", "includesOne", "includesAll"]).optional(),
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

export const ZSurveyCTALogic = ZSurveyLogicBase.extend({
  // "submitted" condition is legacy and should be removed later
  condition: z.enum(["clicked", "submitted", "skipped"]).optional(),
  value: z.undefined(),
});

export const ZSurveyRatingLogic = ZSurveyLogicBase.extend({
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

export const ZSurveyPictureSelectionLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["submitted", "skipped", "equals", "includesOne", "includesAll"]).optional(),
  value: z.union([z.array(z.string()), z.string()]).optional(),
});

export const ZSurveyCalLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["booked", "skipped"]).optional(),
  value: z.undefined(),
});

const ZSurveyMatrixLogic = ZSurveyLogicBase.extend({
  condition: z.enum(["isCompletelySubmitted", "isPartiallySubmitted", "skipped"]).optional(),
  value: z.undefined(),
});

export const ZSurveyLogic = z.union([
  ZSurveyOpenTextLogic,
  ZSurveyConsentLogic,
  ZSurveyMultipleChoiceLogic,
  ZSurveyNPSLogic,
  ZSurveyCTALogic,
  ZSurveyRatingLogic,
  ZSurveyPictureSelectionLogic,
  ZSurveyFileUploadLogic,
  ZSurveyCalLogic,
  ZSurveyMatrixLogic,
  ZSurveyAddressLogic,
]);

export type TSurveyLogic = z.infer<typeof ZSurveyLogic>;

export type TSurveyPictureSelectionLogic = z.infer<typeof ZSurveyPictureSelectionLogic>;

export const ZSurveyQuestionBase = z.object({
  id: ZSurveyQuestionId,
  type: z.string(),
  headline: ZI18nString,
  subheader: ZI18nString.optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  required: z.boolean(),
  buttonLabel: ZI18nString.optional(),
  backButtonLabel: ZI18nString.optional(),
  scale: z.enum(["number", "smiley", "star"]).optional(),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]).optional(),
  logic: z.array(ZSurveyLogic).optional(),
  isDraft: z.boolean().optional(),
});

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextQuestionInputType = z.infer<typeof ZSurveyOpenTextQuestionInputType>;

export const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.OpenText),
  placeholder: ZI18nString.optional(),
  longAnswer: z.boolean().optional(),
  logic: z.array(ZSurveyOpenTextLogic).optional(),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
});

export type TSurveyOpenTextQuestion = z.infer<typeof ZSurveyOpenTextQuestion>;

export const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Consent),
  html: ZI18nString.optional(),
  label: ZI18nString,
  placeholder: z.string().optional(),
  logic: z.array(ZSurveyConsentLogic).optional(),
});

export type TSurveyConsentQuestion = z.infer<typeof ZSurveyConsentQuestion>;

export const ZShuffleOption = z.enum(["none", "all", "exceptLast"]);

export type TShuffleOption = z.infer<typeof ZShuffleOption>;

export const ZSurveyMultipleChoiceQuestion = ZSurveyQuestionBase.extend({
  type: z.union([
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  ]),
  choices: z
    .array(ZSurveyChoice)
    .min(2, { message: "Multiple Choice Question must have at least two choices" }),
  logic: z.array(ZSurveyMultipleChoiceLogic).optional(),
  shuffleOption: ZShuffleOption.optional(),
  otherOptionPlaceholder: ZI18nString.optional(),
}).refine(
  (question) => {
    const { logic, type } = question;

    if (type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) {
      // The single choice question should not have 'includesAll' logic
      return !logic?.some((l) => l.condition === "includesAll");
    }
    // The multi choice question should not have 'notEquals' logic
    return !logic?.some((l) => l.condition === "notEquals");
  },
  {
    message:
      "MultipleChoiceSingle question should not have 'includesAll' logic and MultipleChoiceMulti question should not have 'notEquals' logic",
  }
);

export type TSurveyMultipleChoiceQuestion = z.infer<typeof ZSurveyMultipleChoiceQuestion>;

export const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.NPS),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
  logic: z.array(ZSurveyNPSLogic).optional(),
});

export type TSurveyNPSQuestion = z.infer<typeof ZSurveyNPSQuestion>;

export const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CTA),
  html: ZI18nString.optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: ZI18nString.optional(),
  logic: z.array(ZSurveyCTALogic).optional(),
});

export type TSurveyCTAQuestion = z.infer<typeof ZSurveyCTAQuestion>;

export const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
  logic: z.array(ZSurveyRatingLogic).optional(),
});

export const ZSurveyDateQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Date),
  html: ZI18nString.optional(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"]),
});

export type TSurveyDateQuestion = z.infer<typeof ZSurveyDateQuestion>;

export type TSurveyRatingQuestion = z.infer<typeof ZSurveyRatingQuestion>;

export const ZSurveyPictureSelectionQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  allowMulti: z.boolean().optional().default(false),
  choices: z
    .array(ZSurveyPictureChoice)
    .min(2, { message: "Picture Selection question must have atleast 2 choices" }),
  logic: z.array(ZSurveyPictureSelectionLogic).optional(),
});

export type TSurveyPictureSelectionQuestion = z.infer<typeof ZSurveyPictureSelectionQuestion>;

export const ZSurveyFileUploadQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
  logic: z.array(ZSurveyFileUploadLogic).optional(),
});

export type TSurveyFileUploadQuestion = z.infer<typeof ZSurveyFileUploadQuestion>;

export const ZSurveyCalQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Cal),
  calUserName: z.string().min(1, { message: "Cal user name is required" }),
  calHost: z.string().optional(),
  logic: z.array(ZSurveyCalLogic).optional(),
});

export type TSurveyCalQuestion = z.infer<typeof ZSurveyCalQuestion>;

export const ZSurveyMatrixQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Matrix),
  rows: z.array(ZI18nString),
  columns: z.array(ZI18nString),
  logic: z.array(ZSurveyMatrixLogic).optional(),
});

export type TSurveyMatrixQuestion = z.infer<typeof ZSurveyMatrixQuestion>;

export const ZSurveyAddressQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Address),
  isAddressLine1Required: z.boolean().default(false),
  isAddressLine2Required: z.boolean().default(false),
  isCityRequired: z.boolean().default(false),
  isStateRequired: z.boolean().default(false),
  isZipRequired: z.boolean().default(false),
  isCountryRequired: z.boolean().default(false),
});
export type TSurveyAddressQuestion = z.infer<typeof ZSurveyAddressQuestion>;

export const ZSurveyQuestion = z.union([
  ZSurveyOpenTextQuestion,
  ZSurveyConsentQuestion,
  ZSurveyMultipleChoiceQuestion,
  ZSurveyNPSQuestion,
  ZSurveyCTAQuestion,
  ZSurveyRatingQuestion,
  ZSurveyPictureSelectionQuestion,
  ZSurveyDateQuestion,
  ZSurveyFileUploadQuestion,
  ZSurveyCalQuestion,
  ZSurveyMatrixQuestion,
  ZSurveyAddressQuestion,
]);

export type TSurveyQuestion = z.infer<typeof ZSurveyQuestion>;

export const ZSurveyQuestions = z.array(ZSurveyQuestion);

export type TSurveyQuestions = z.infer<typeof ZSurveyQuestions>;

export const ZSurveyQuestionType = z.enum([
  TSurveyQuestionTypeEnum.Address,
  TSurveyQuestionTypeEnum.CTA,
  TSurveyQuestionTypeEnum.Consent,
  TSurveyQuestionTypeEnum.Date,
  TSurveyQuestionTypeEnum.FileUpload,
  TSurveyQuestionTypeEnum.Matrix,
  TSurveyQuestionTypeEnum.MultipleChoiceMulti,
  TSurveyQuestionTypeEnum.MultipleChoiceSingle,
  TSurveyQuestionTypeEnum.NPS,
  TSurveyQuestionTypeEnum.OpenText,
  TSurveyQuestionTypeEnum.PictureSelection,
  TSurveyQuestionTypeEnum.Rating,
  TSurveyQuestionTypeEnum.Cal,
]);

export type TSurveyQuestionType = z.infer<typeof ZSurveyQuestionType>;

export const ZSurveyLanguage = z.object({
  language: ZLanguage,
  default: z.boolean(),
  enabled: z.boolean(),
});

export type TSurveyLanguage = z.infer<typeof ZSurveyLanguage>;

export const ZSurveyQuestionsObject = z.object({
  questions: ZSurveyQuestions,
  hiddenFields: ZSurveyHiddenFields,
});

export type TSurveyQuestionsObject = z.infer<typeof ZSurveyQuestionsObject>;

export const ZSurveyDisplayOption = z.enum([
  "displayOnce",
  "displayMultiple",
  "respondMultiple",
  "displaySome",
]);

export type TSurveyDisplayOption = z.infer<typeof ZSurveyDisplayOption>;

export const ZSurveyType = z.enum(["link", "app", "website"]);

export type TSurveyType = z.infer<typeof ZSurveyType>;

export const ZSurveyStatus = z.enum(["draft", "scheduled", "inProgress", "paused", "completed"]);

export type TSurveyStatus = z.infer<typeof ZSurveyStatus>;

export const ZSurveyInlineTriggers = z.object({
  codeConfig: z.object({ identifier: z.string() }).optional(),
  noCodeConfig: ZActionClassNoCodeConfig.optional(),
});

export type TSurveyInlineTriggers = z.infer<typeof ZSurveyInlineTriggers>;

export const ZSurvey = z
  .object({
    id: z.string().cuid2(),
    createdAt: z.date(),
    updatedAt: z.date(),
    name: z.string(),
    type: ZSurveyType,
    environmentId: z.string(),
    createdBy: z.string().nullable(),
    status: ZSurveyStatus,
    displayOption: ZSurveyDisplayOption,
    autoClose: z.number().nullable(),
    triggers: z.array(z.object({ actionClass: ZActionClass })),
    recontactDays: z.number().nullable(),
    displayLimit: z.number().nullable(),
    welcomeCard: ZSurveyWelcomeCard,
    questions: ZSurveyQuestions.min(1, {
      message: "Survey must have at least one question",
    }).superRefine((questions, ctx) => {
      const questionIds = questions.map((q) => q.id);
      const uniqueQuestionIds = new Set(questionIds);
      if (uniqueQuestionIds.size !== questionIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Question IDs must be unique",
          path: [questionIds.findIndex((id, index) => questionIds.indexOf(id) !== index), "id"],
        });
      }
    }),
    endings: ZSurveyEndings.superRefine((endings, ctx) => {
      const endingIds = endings.map((q) => q.id);
      const uniqueEndingIds = new Set(endingIds);
      if (uniqueEndingIds.size !== endingIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ending IDs must be unique",
          path: [endingIds.findIndex((id, index) => endingIds.indexOf(id) !== index), "id"],
        });
      }
    }),
    hiddenFields: ZSurveyHiddenFields,
    variables: ZSurveyVariables.superRefine((variables, ctx) => {
      // variable ids must be unique
      const variableIds = variables.map((v) => v.id);
      const uniqueVariableIds = new Set(variableIds);
      if (uniqueVariableIds.size !== variableIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variable IDs must be unique",
          path: ["variables"],
        });
      }

      // variable names must be unique
      const variableNames = variables.map((v) => v.name);
      const uniqueVariableNames = new Set(variableNames);
      if (uniqueVariableNames.size !== variableNames.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variable names must be unique",
          path: ["variables"],
        });
      }
    }),
    delay: z.number(),
    autoComplete: z.number().min(1, { message: "Response limit must be greater than 0" }).nullable(),
    runOnDate: z.date().nullable(),
    closeOnDate: z.date().nullable(),
    productOverwrites: ZSurveyProductOverwrites.nullable(),
    styling: ZSurveyStyling.nullable(),
    showLanguageSwitch: z.boolean().nullable(),
    surveyClosedMessage: ZSurveyClosedMessage.nullable(),
    segment: ZSegment.nullable(),
    singleUse: ZSurveySingleUse.nullable(),
    isVerifyEmailEnabled: z.boolean(),
    pin: z.string().min(4, { message: "PIN must be a four digit number" }).nullish(),
    resultShareKey: z.string().nullable(),
    displayPercentage: z.number().min(0.01).max(100).nullable(),
    languages: z.array(ZSurveyLanguage),
  })
  .superRefine((survey, ctx) => {
    const { questions, languages, welcomeCard, endings } = survey;

    let multiLangIssue: z.IssueData | null;

    // welcome card validations
    if (welcomeCard.enabled) {
      if (welcomeCard.headline) {
        multiLangIssue = validateCardFieldsForAllLanguages(
          "cardHeadline",
          welcomeCard.headline,
          languages,
          "welcome"
        );

        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }

      if (welcomeCard.html && welcomeCard.html.default.trim() !== "") {
        multiLangIssue = validateCardFieldsForAllLanguages(
          "welcomeCardHtml",
          welcomeCard.html,
          languages,
          "welcome"
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }

      if (welcomeCard.buttonLabel && welcomeCard.buttonLabel.default.trim() !== "") {
        multiLangIssue = validateCardFieldsForAllLanguages(
          "buttonLabel",
          welcomeCard.buttonLabel,
          languages,
          "welcome"
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }
    }

    // Custom default validation for each question
    questions.forEach((question, questionIndex) => {
      const existingLogicConditions = new Set();
      multiLangIssue = validateQuestionLabels("headline", question.headline, languages, questionIndex);
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }

      if (question.subheader && question.subheader.default.trim() !== "") {
        multiLangIssue = validateQuestionLabels("subheader", question.subheader, languages, questionIndex);
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }

      const defaultLanguageCode = "default";
      const initialFieldsToValidate = [
        "html",
        "buttonLabel",
        "upperLabel",
        "lowerLabel",
        "label",
        "placeholder",
      ];

      const fieldsToValidate =
        questionIndex === 0 ? initialFieldsToValidate : [...initialFieldsToValidate, "backButtonLabel"];

      for (const field of fieldsToValidate) {
        // Skip label validation for consent questions as its called checkbox label
        if (field === "label" && question.type === TSurveyQuestionTypeEnum.Consent) {
          continue;
        }

        const questionFieldValue = question[field as keyof typeof question] as TI18nString | null;
        if (
          typeof questionFieldValue?.[defaultLanguageCode] !== "undefined" &&
          questionFieldValue[defaultLanguageCode].trim() !== ""
        ) {
          multiLangIssue = validateQuestionLabels(field, questionFieldValue, languages, questionIndex);
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.OpenText) {
        if (
          question.placeholder &&
          question.placeholder[defaultLanguageCode].trim() !== "" &&
          languages.length > 1
        ) {
          multiLangIssue = validateQuestionLabels(
            "placeholder",
            question.placeholder,
            languages,
            questionIndex
          );
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        }
      }

      if (
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
      ) {
        question.choices.forEach((choice, choiceIndex) => {
          multiLangIssue = validateQuestionLabels(
            `Choice ${String(choiceIndex + 1)}`,
            choice.label,
            languages,
            questionIndex,
            true
          );
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        });

        const duplicateChoicesLanguageCodes = findLanguageCodesForDuplicateLabels(
          question.choices.map((choice) => choice.label),
          languages
        );

        if (duplicateChoicesLanguageCodes.length > 0) {
          const invalidLanguageCodes = duplicateChoicesLanguageCodes.map((invalidLanguageCode) =>
            invalidLanguageCode === "default"
              ? (languages.find((lang) => lang.default)?.language.code ?? "default")
              : invalidLanguageCode
          );

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} has duplicate choice labels ${isDefaultOnly ? "" : "for the following languages:"}`,
            path: ["questions", questionIndex, "choices"],
            params: isDefaultOnly ? undefined : { invalidLanguageCodes },
          });
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.Consent) {
        multiLangIssue = validateQuestionLabels("consent.label", question.label, languages, questionIndex);

        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.CTA) {
        if (!question.required && question.dismissButtonLabel) {
          multiLangIssue = validateQuestionLabels(
            "dismissButtonLabel",
            question.dismissButtonLabel,
            languages,
            questionIndex
          );
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        }

        if (question.buttonExternal) {
          const parsedButtonUrl = z.string().url().safeParse(question.buttonUrl);
          if (!parsedButtonUrl.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Question ${String(questionIndex + 1)} has an invalid button URL`,
              path: ["questions", questionIndex, "buttonUrl"],
            });
          }
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.Matrix) {
        question.rows.forEach((row, rowIndex) => {
          multiLangIssue = validateQuestionLabels(
            `Row ${String(rowIndex + 1)}`,
            row,
            languages,
            questionIndex,
            true
          );
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        });

        question.columns.forEach((column, columnIndex) => {
          multiLangIssue = validateQuestionLabels(
            `Column ${String(columnIndex + 1)}`,
            column,
            languages,
            questionIndex,
            true
          );
          if (multiLangIssue) {
            ctx.addIssue(multiLangIssue);
          }
        });

        const duplicateRowsLanguageCodes = findLanguageCodesForDuplicateLabels(question.rows, languages);
        const duplicateColumnLanguageCodes = findLanguageCodesForDuplicateLabels(question.columns, languages);

        if (duplicateRowsLanguageCodes.length > 0) {
          const invalidLanguageCodes = duplicateRowsLanguageCodes.map((invalidLanguageCode) =>
            invalidLanguageCode === "default"
              ? (languages.find((lang) => lang.default)?.language.code ?? "default")
              : invalidLanguageCode
          );

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} has duplicate row labels ${isDefaultOnly ? "" : "for the following languages:"}`,
            path: ["questions", questionIndex, "rows"],
            params: isDefaultOnly ? undefined : { invalidLanguageCodes },
          });
        }

        if (duplicateColumnLanguageCodes.length > 0) {
          const invalidLanguageCodes = duplicateColumnLanguageCodes.map((invalidLanguageCode) =>
            invalidLanguageCode === "default"
              ? (languages.find((lang) => lang.default)?.language.code ?? "default")
              : invalidLanguageCode
          );

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} has duplicate column labels ${isDefaultOnly ? "" : "for the following languages:"}`,
            path: ["questions", questionIndex, "columns"],
            params: isDefaultOnly ? undefined : { invalidLanguageCodes },
          });
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.FileUpload) {
        // allowedFileExtensions must have atleast one element
        if (question.allowedFileExtensions && question.allowedFileExtensions.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} must have atleast one allowed file extension`,
            path: ["questions", questionIndex, "allowedFileExtensions"],
          });
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.Cal) {
        if (question.calHost !== undefined) {
          const hostnameRegex = /^[a-zA-Z0-9]+(?<domain>\.[a-zA-Z0-9]+)+$/;
          if (!hostnameRegex.test(question.calHost)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Question ${String(questionIndex + 1)} must have a valid host name`,
              path: ["questions", questionIndex, "calHost"],
            });
          }
        }
      }

      if (question.logic) {
        question.logic.forEach((logic, logicIndex) => {
          const logicConditions = ["condition", "value", "destination"] as const;
          const validFields = logicConditions.filter((field) => logic[field] !== undefined).length;

          if (validFields < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Logic for question ${String(questionIndex + 1)} is missing required fields`,
              path: ["questions", questionIndex, "logic"],
            });
          }

          if (question.required && logic.condition === "skipped") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Logic for question ${String(questionIndex + 1)} is invalid. Required questions cannot be skipped.`,
              path: ["questions", questionIndex, "logic"],
            });
          }

          // logic condition and value mapping should not be repeated
          const thisLogic = `${logic.condition ?? ""}-${Array.isArray(logic.value) ? logic.value.sort().join(",") : String(logic.value)}`;
          if (existingLogicConditions.has(thisLogic)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "There are two competing logic conditions: Please update or delete one in the Questions tab.",
              path: ["questions", questionIndex, "logic", logicIndex],
            });
          }
          existingLogicConditions.add(thisLogic);
        });
      }
    });

    const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(questions);
    if (questionsWithCyclicLogic.length > 0) {
      questionsWithCyclicLogic.forEach((questionId) => {
        const questionIndex = questions.findIndex((q) => q.id === questionId);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Cyclic logic detected 🔃 Please check the logic of question ${String(questionIndex + 1)}.`,
          path: ["questions", questionIndex, "logic"],
        });
      });
    }
    endings.forEach((ending, index) => {
      // thank you card validations
      if (ending.type === "endScreen") {
        const multiLangIssueInHeadline = validateCardFieldsForAllLanguages(
          "cardHeadline",
          ending.headline ?? {},
          languages,
          "end",
          index
        );

        if (multiLangIssueInHeadline) {
          ctx.addIssue(multiLangIssueInHeadline);
        }

        if (ending.subheader) {
          const multiLangIssueInSubheader = validateCardFieldsForAllLanguages(
            "subheader",
            ending.subheader,
            languages,
            "end",
            index
          );

          if (multiLangIssueInSubheader) {
            ctx.addIssue(multiLangIssueInSubheader);
          }
        }

        if (ending.buttonLabel) {
          const multiLangIssueInButtonLabel = validateCardFieldsForAllLanguages(
            "endingCardButtonLabel",
            ending.buttonLabel,
            languages,
            "end",
            index
          );
          if (multiLangIssueInButtonLabel) {
            ctx.addIssue(multiLangIssueInButtonLabel);
          }
        }
      }
      if (ending.type === "redirectToUrl") {
        if (!ending.label || ending.label.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Redirect Url label cannot be empty for ending Card ${String(index + 1)}.`,
            path: ["endings", index, "label"],
          });
        }
      }
    });
  });

// ZSurvey is a refinement, so to extend it to ZSurveyUpdateInput, we need to transform the innerType and then apply the same refinements.
export const ZSurveyUpdateInput = ZSurvey.innerType()
  .omit({ createdAt: true, updatedAt: true })
  .and(
    z.object({
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
  )
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => undefined);

// Helper function to make all properties of a Zod object schema optional
const makeSchemaOptional = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => {
  return schema.extend(
    Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, value.optional()])) as {
      [K in keyof T]: z.ZodOptional<T[K]>;
    }
  );
};

export const ZSurveyCreateInput = makeSchemaOptional(ZSurvey.innerType())
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    productOverwrites: true,
    languages: true,
  })
  .extend({
    name: z.string(), // Keep name required
    questions: ZSurvey.innerType().shape.questions, // Keep questions required and with its original validation
    languages: z.array(ZSurveyLanguage).default([]),
    welcomeCard: ZSurveyWelcomeCard.default({
      enabled: false,
    }),
    endings: ZSurveyEndings.default([]),
    type: ZSurveyType.default("link"),
  })
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null);

export type TSurvey = z.infer<typeof ZSurvey>;

export interface TSurveyDates {
  createdAt: TSurvey["createdAt"];
  updatedAt: TSurvey["updatedAt"];
  runOnDate: TSurvey["runOnDate"];
  closeOnDate: TSurvey["closeOnDate"];
}

export type TSurveyCreateInput = z.input<typeof ZSurveyCreateInput>;

export type TSurveyEditorTabs = "questions" | "settings" | "styling";

export const ZSurveyQuestionSummaryOpenText = z.object({
  type: z.literal("openText"),
  question: ZSurveyOpenTextQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      personAttributes: ZAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryOpenText = z.infer<typeof ZSurveyQuestionSummaryOpenText>;

export const ZSurveyQuestionSummaryMultipleChoice = z.object({
  type: z.union([z.literal("multipleChoiceMulti"), z.literal("multipleChoiceSingle")]),
  question: ZSurveyMultipleChoiceQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      percentage: z.number(),
      others: z
        .array(
          z.object({
            value: z.string(),
            person: z
              .object({
                id: ZId,
                userId: z.string(),
              })
              .nullable(),
            personAttributes: ZAttributes.nullable(),
          })
        )
        .optional(),
    })
  ),
});

export type TSurveyQuestionSummaryMultipleChoice = z.infer<typeof ZSurveyQuestionSummaryMultipleChoice>;

export const ZSurveyQuestionSummaryPictureSelection = z.object({
  type: z.literal("pictureSelection"),
  question: ZSurveyPictureSelectionQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
});

export type TSurveyQuestionSummaryPictureSelection = z.infer<typeof ZSurveyQuestionSummaryPictureSelection>;

export const ZSurveyQuestionSummaryRating = z.object({
  type: z.literal("rating"),
  question: ZSurveyRatingQuestion,
  responseCount: z.number(),
  average: z.number(),
  choices: z.array(
    z.object({
      rating: z.number(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
  dismissed: z.object({
    count: z.number(),
  }),
});

export type TSurveyQuestionSummaryRating = z.infer<typeof ZSurveyQuestionSummaryRating>;

export const ZSurveyQuestionSummaryNps = z.object({
  type: z.literal("nps"),
  question: ZSurveyNPSQuestion,
  responseCount: z.number(),
  total: z.number(),
  score: z.number(),
  promoters: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  passives: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  detractors: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveyQuestionSummaryNps = z.infer<typeof ZSurveyQuestionSummaryNps>;

export const ZSurveyQuestionSummaryCta = z.object({
  type: z.literal("cta"),
  question: ZSurveyCTAQuestion,
  impressionCount: z.number(),
  clickCount: z.number(),
  skipCount: z.number(),
  responseCount: z.number(),
  ctr: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveyQuestionSummaryCta = z.infer<typeof ZSurveyQuestionSummaryCta>;

export const ZSurveyQuestionSummaryConsent = z.object({
  type: z.literal("consent"),
  question: ZSurveyConsentQuestion,
  responseCount: z.number(),
  accepted: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveyQuestionSummaryConsent = z.infer<typeof ZSurveyQuestionSummaryConsent>;

export const ZSurveyQuestionSummaryDate = z.object({
  type: z.literal("date"),
  question: ZSurveyDateQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      personAttributes: ZAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryDate = z.infer<typeof ZSurveyQuestionSummaryDate>;

export const ZSurveyQuestionSummaryFileUpload = z.object({
  type: z.literal("fileUpload"),
  question: ZSurveyFileUploadQuestion,
  responseCount: z.number(),
  files: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      personAttributes: ZAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryFileUpload = z.infer<typeof ZSurveyQuestionSummaryFileUpload>;

export const ZSurveyQuestionSummaryCal = z.object({
  type: z.literal("cal"),
  question: ZSurveyCalQuestion,
  responseCount: z.number(),
  booked: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
  skipped: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveyQuestionSummaryCal = z.infer<typeof ZSurveyQuestionSummaryCal>;

export const ZSurveyQuestionSummaryMatrix = z.object({
  type: z.literal("matrix"),
  question: ZSurveyMatrixQuestion,
  responseCount: z.number(),
  data: z.array(
    z.object({
      rowLabel: z.string(),
      columnPercentages: z.record(z.string(), z.number()),
      totalResponsesForRow: z.number(),
    })
  ),
});

export type TSurveyQuestionSummaryMatrix = z.infer<typeof ZSurveyQuestionSummaryMatrix>;

export const ZSurveyQuestionSummaryHiddenFields = z.object({
  type: z.literal("hiddenField"),
  id: z.string(),
  responseCount: z.number(),
  samples: z.array(
    z.object({
      updatedAt: z.date(),
      value: z.string(),
      person: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      personAttributes: ZAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryHiddenFields = z.infer<typeof ZSurveyQuestionSummaryHiddenFields>;

export const ZSurveyQuestionSummaryAddress = z.object({
  type: z.literal("address"),
  question: ZSurveyAddressQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      personAttributes: ZAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryAddress = z.infer<typeof ZSurveyQuestionSummaryAddress>;

export const ZSurveyQuestionSummary = z.union([
  ZSurveyQuestionSummaryOpenText,
  ZSurveyQuestionSummaryMultipleChoice,
  ZSurveyQuestionSummaryPictureSelection,
  ZSurveyQuestionSummaryRating,
  ZSurveyQuestionSummaryNps,
  ZSurveyQuestionSummaryCta,
  ZSurveyQuestionSummaryConsent,
  ZSurveyQuestionSummaryDate,
  ZSurveyQuestionSummaryFileUpload,
  ZSurveyQuestionSummaryCal,
  ZSurveyQuestionSummaryMatrix,
  ZSurveyQuestionSummaryAddress,
]);

export type TSurveyQuestionSummary = z.infer<typeof ZSurveyQuestionSummary>;

export const ZSurveySummary = z.object({
  meta: z.object({
    displayCount: z.number(),
    totalResponses: z.number(),
    startsPercentage: z.number(),
    completedResponses: z.number(),
    completedPercentage: z.number(),
    dropOffCount: z.number(),
    dropOffPercentage: z.number(),
    ttcAverage: z.number(),
  }),
  dropOff: z.array(
    z.object({
      questionId: z.string().cuid2(),
      headline: z.string(),
      ttc: z.number(),
      impressions: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number(),
    })
  ),
  summary: z.array(z.union([ZSurveyQuestionSummary, ZSurveyQuestionSummaryHiddenFields])),
});

export const ZSurveyFilterCriteria = z.object({
  name: z.string().optional(),
  status: z.array(ZSurveyStatus).optional(),
  type: z.array(ZSurveyType).optional(),
  createdBy: z
    .object({
      userId: z.string(),
      value: z.array(z.enum(["you", "others"])),
    })
    .optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).optional(),
});

export type TSurveyFilterCriteria = z.infer<typeof ZSurveyFilterCriteria>;

const ZSurveyFilters = z.object({
  name: z.string(),
  createdBy: z.array(z.enum(["you", "others"])),
  status: z.array(ZSurveyStatus),
  type: z.array(ZSurveyType),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]),
});

export type TSurveyFilters = z.infer<typeof ZSurveyFilters>;

const ZFilterOption = z.object({
  label: z.string(),
  value: z.string(),
});

export type TFilterOption = z.infer<typeof ZFilterOption>;

const ZSortOption = z.object({
  label: z.string(),
  value: z.enum(["createdAt", "updatedAt", "name"]),
});

export type TSortOption = z.infer<typeof ZSortOption>;
export type TSurveySummary = z.infer<typeof ZSurveySummary>;

export const ZSurveyRecallItem = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["question", "hiddenField", "attributeClass", "variable"]),
});

export type TSurveyRecallItem = z.infer<typeof ZSurveyRecallItem>;

export const ZSurveyCopyFormValidation = z.object({
  products: z.array(
    z.object({
      product: z.string(),
      environments: z.array(z.string()),
    })
  ),
});

export type TSurveyCopyFormData = z.infer<typeof ZSurveyCopyFormValidation>;
