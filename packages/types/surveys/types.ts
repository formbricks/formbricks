import { type ZodIssue, z } from "zod";
import { ZSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { ZActionClass, ZActionClassNoCodeConfig } from "../action-classes";
import { ZColor, ZId, ZPlacement, ZUrl, getZSafeUrl } from "../common";
import { ZContactAttributes } from "../contact-attribute";
import { type TI18nString, ZI18nString } from "../i18n";
import { ZLanguage } from "../project";
import { ZSegment } from "../segment";
import { ZAllowedFileExtension } from "../storage";
import { ZBaseStyling } from "../styling";
import { type TSurveyBlock, type TSurveyBlockLogicAction, ZSurveyBlocks } from "./blocks";
import { findBlocksWithCyclicLogic } from "./blocks-validation";
import {
  type TSurveyElement,
  TSurveyElementTypeEnum,
  ZSurveyAddressElement,
  ZSurveyCTAElement,
  ZSurveyCalElement,
  ZSurveyConsentElement,
  ZSurveyContactInfoElement,
  ZSurveyDateElement,
  ZSurveyFileUploadElement,
  ZSurveyMatrixElement,
  ZSurveyMultipleChoiceElement,
  ZSurveyNPSElement,
  ZSurveyOpenTextElement,
  ZSurveyPictureSelectionElement,
  ZSurveyRankingElement,
  ZSurveyRatingElement,
} from "./elements";
import { validateElementLabels } from "./elements-validation";
import {
  type TConditionGroup,
  type TConditionGroupDeprecated,
  type TSingleCondition,
  type TSingleConditionDeprecated,
  type TSurveyLogicConditionsOperator,
  ZActionNumberVariableCalculateOperator,
  ZActionTextVariableCalculateOperator,
  ZConditionGroup,
  ZConditionGroupDeprecated,
  ZDynamicLogicFieldValueDeprecated,
} from "./logic";
import {
  FORBIDDEN_IDS,
  findLanguageCodesForDuplicateLabels,
  findQuestionsWithCyclicLogic,
  getTextContent,
  isConditionGroup,
  validateCardFieldsForAllLanguages,
  validateQuestionLabels,
} from "./validation";

const ZSurveyEndingBase = z.object({
  id: z.string().cuid2(),
});

export const ZSurveyEndScreenCard = ZSurveyEndingBase.extend({
  type: z.literal("endScreen"),
  headline: ZI18nString.optional(),
  subheader: ZI18nString.optional(),
  buttonLabel: ZI18nString.optional(),
  buttonLink: ZUrl.optional(),
  imageUrl: ZUrl.optional(),
  videoUrl: ZUrl.optional(),
});

export type TSurveyEndScreenCard = z.infer<typeof ZSurveyEndScreenCard>;

export const ZSurveyRedirectUrlCard = ZSurveyEndingBase.extend({
  type: z.literal("redirectToUrl"),
  url: ZUrl.optional(),
  label: z.string().optional(),
});

export type TSurveyRedirectUrlCard = z.infer<typeof ZSurveyRedirectUrlCard>;

export const ZSurveyEnding = z.union([ZSurveyEndScreenCard, ZSurveyRedirectUrlCard]);

export type TSurveyEnding = z.infer<typeof ZSurveyEnding>;

export const ZSurveyEndings = z.array(ZSurveyEnding);

export type TSurveyEndings = z.infer<typeof ZSurveyEndings>;

/**
 * @deprecated Use TSurveyElementTypeEnum instead. This enum is kept for v1 API backward compatibility only.
 */
/**
 * @deprecated Use TSurveyElementTypeEnum instead. This enum is kept for v1 API backward compatibility only.
 */
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
  Ranking = "ranking",
  ContactInfo = "contactInfo",
}

/**
 * @deprecated Use ZSurveyElementId / TSurveyElementId instead. Kept for v1 API backward compatibility only.
 */
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

/**
 * @deprecated Use TSurveyElementId instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyQuestionId = z.infer<typeof ZSurveyQuestionId>;

export const ZSurveyWelcomeCard = z
  .object({
    enabled: z.boolean(),
    headline: ZI18nString.optional(),
    subheader: ZI18nString.optional(),
    fileUrl: ZUrl.optional(),
    buttonLabel: ZI18nString.optional(),
    timeToFinish: z.boolean().default(true),
    showResponseCount: z.boolean().default(false),
    videoUrl: ZUrl.optional(),
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

export const ZSurveyProjectOverwrites = z.object({
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  placement: ZPlacement.nullish(),
  clickOutsideClose: z.boolean().nullish(),
  darkOverlay: z.boolean().nullish(),
});

export type TSurveyProjectOverwrites = z.infer<typeof ZSurveyProjectOverwrites>;

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

export const ZSurveyRecaptcha = z
  .object({
    enabled: z.boolean(),
    threshold: z.number().min(0.1).max(0.9).step(0.1),
  })
  .nullable();

export type TSurveyRecaptcha = z.infer<typeof ZSurveyRecaptcha>;

export const ZSurveyMetadata = z.object({
  title: ZI18nString.optional(),
  description: ZI18nString.optional(),
  ogImage: z.string().url().optional(),
});

export type TSurveyMetadata = z.infer<typeof ZSurveyMetadata>;

export const ZSurveyQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export const ZSurveyPictureChoice = z.object({
  id: z.string(),
  imageUrl: z.string(),
});

export type TSurveyPictureChoice = z.infer<typeof ZSurveyPictureChoice>;

export type TSurveyQuestionChoice = z.infer<typeof ZSurveyQuestionChoice>;

// Actions for question logic
export const ZDynamicLogicField = z.enum(["question", "variable", "hiddenField"]);
/**
 * @deprecated "jumpToQuestion" is deprecated, use "jumpToBlock" instead. Kept for v1 API backward compatibility only.
 */
export const ZActionObjective = z.enum(["calculate", "requireAnswer", "jumpToQuestion"]);

export type TDynamicLogicField = z.infer<typeof ZDynamicLogicField>;
export type TActionObjective = z.infer<typeof ZActionObjective>;

const ZActionBase = z.object({
  id: ZId,
  objective: ZActionObjective,
});

export type TActionBase = z.infer<typeof ZActionBase>;

const ZActionCalculateBase = ZActionBase.extend({
  objective: z.literal("calculate"),
  variableId: z.string(),
});

export const ZActionCalculateText = ZActionCalculateBase.extend({
  operator: ZActionTextVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z
        .string({ message: "Conditional Logic: Value must be a string for text variable" })
        .min(1, "Conditional Logic: Please enter a value in logic field"),
    }),
    ZDynamicLogicFieldValueDeprecated, // Accept both "question" and "element" for backward compatibility
  ]),
});

export const ZActionCalculateNumber = ZActionCalculateBase.extend({
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.number({ message: "Conditional Logic: Value must be a number for number variable" }),
    }),
    ZDynamicLogicFieldValueDeprecated, // Accept both "question" and "element" for backward compatibility
  ]),
}).superRefine((val, ctx) => {
  if (val.operator === "divide" && val.value.type === "static" && val.value.value === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conditional Logic: Cannot divide by zero",
      path: ["value", "value"],
    });
  }
});

const ZActionCalculate = z.union([ZActionCalculateText, ZActionCalculateNumber]);

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
  target: z.string().min(1, "Conditional Logic: Target question id cannot be empty"),
});
export type TActionRequireAnswer = z.infer<typeof ZActionRequireAnswer>;

/**
 * @deprecated Use jumpToBlock action instead. Kept for v1 API backward compatibility only.
 */
const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string().min(1, "Conditional Logic: Target question id cannot be empty"),
});

/**
 * @deprecated Use TActionJumpToBlock instead. Kept for v1 API backward compatibility only.
 */
export type TActionJumpToQuestion = z.infer<typeof ZActionJumpToQuestion>;

export const ZSurveyLogicAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToQuestion]);

export type TSurveyLogicAction = z.infer<typeof ZSurveyLogicAction>;

const ZSurveyLogicActions = z.array(ZSurveyLogicAction);

export type TSurveyLogicActions = z.infer<typeof ZSurveyLogicActions>;

export const ZSurveyLogic = z.object({
  id: ZId,
  conditions: ZConditionGroup,
  actions: ZSurveyLogicActions,
});

export type TSurveyLogic = z.infer<typeof ZSurveyLogic>;

/**
 * @deprecated Use element-specific schemas instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyLogicDeprecated = z.object({
  id: ZId,
  conditions: ZConditionGroupDeprecated,
  actions: ZSurveyLogicActions, // Reuse the same actions since they accept both formats
});

export type TSurveyLogicDeprecated = z.infer<typeof ZSurveyLogicDeprecated>;

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
  logic: z.array(ZSurveyLogicDeprecated).optional(),
  logicFallback: ZSurveyQuestionId.optional(),
  isDraft: z.boolean().optional(),
});

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextQuestionInputType = z.infer<typeof ZSurveyOpenTextQuestionInputType>;

/**
 * @deprecated Use ZSurveyOpenTextElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.OpenText),
  placeholder: ZI18nString.optional(),
  longAnswer: z.boolean().optional(),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
  insightsEnabled: z.boolean().default(false).optional(),
  charLimit: z
    .object({
      enabled: z.boolean().default(false).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .default({ enabled: false }),
}).superRefine((data, ctx) => {
  if (data.charLimit.enabled && data.charLimit.min === undefined && data.charLimit.max === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter the values for either minimum or maximum field",
    });
  }

  if (
    (data.charLimit.min !== undefined && data.charLimit.min < 0) ||
    (data.charLimit.max !== undefined && data.charLimit.max < 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The character limit values should be positive",
    });
  }

  if (
    data.charLimit.min !== undefined &&
    data.charLimit.max !== undefined &&
    data.charLimit.min > data.charLimit.max
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum value cannot be greater than the maximum value",
    });
  }
});

/**
 * @deprecated Use TSurveyOpenTextElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyOpenTextQuestion = z.infer<typeof ZSurveyOpenTextQuestion>;

/**
 * @deprecated Use ZSurveyConsentElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Consent),
  label: ZI18nString,
});

/**
 * @deprecated Use TSurveyConsentElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyConsentQuestion = z.infer<typeof ZSurveyConsentQuestion>;

export const ZShuffleOption = z.enum(["none", "all", "exceptLast"]);

export type TShuffleOption = z.infer<typeof ZShuffleOption>;

/**
 * @deprecated Use ZSurveyMultipleChoiceElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyMultipleChoiceQuestion = ZSurveyQuestionBase.extend({
  type: z.union([
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  ]),
  choices: z
    .array(ZSurveyQuestionChoice)
    .min(2, { message: "Multiple Choice Question must have at least two choices" }),
  shuffleOption: ZShuffleOption.optional(),
  otherOptionPlaceholder: ZI18nString.optional(),
});

/**
 * @deprecated Use TSurveyMultipleChoiceElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyMultipleChoiceQuestion = z.infer<typeof ZSurveyMultipleChoiceQuestion>;

/**
 * @deprecated Use ZSurveyNPSElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.NPS),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
});

/**
 * @deprecated Use TSurveyNPSElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyNPSQuestion = z.infer<typeof ZSurveyNPSQuestion>;

/**
 * @deprecated Use ZSurveyCTAElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CTA),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: ZI18nString.optional(),
});

/**
 * @deprecated Use TSurveyCTAElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyCTAQuestion = z.infer<typeof ZSurveyCTAQuestion>;

/**
 * @deprecated Use ZSurveyRatingElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(6), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
});

/**
 * @deprecated Use ZSurveyDateElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyDateQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Date),
  html: ZI18nString.optional(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"]),
});

/**
 * @deprecated Use TSurveyDateElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyDateQuestion = z.infer<typeof ZSurveyDateQuestion>;

/**
 * @deprecated Use TSurveyRatingElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyRatingQuestion = z.infer<typeof ZSurveyRatingQuestion>;

/**
 * @deprecated Use ZSurveyPictureSelectionElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyPictureSelectionQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  allowMulti: z.boolean().optional().default(false),
  choices: z
    .array(ZSurveyPictureChoice)
    .min(2, { message: "Picture Selection question must have atleast 2 choices" }),
});

/**
 * @deprecated Use TSurveyPictureSelectionElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyPictureSelectionQuestion = z.infer<typeof ZSurveyPictureSelectionQuestion>;

/**
 * @deprecated Use ZSurveyFileUploadElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyFileUploadQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
});

/**
 * @deprecated Use TSurveyFileUploadElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyFileUploadQuestion = z.infer<typeof ZSurveyFileUploadQuestion>;

/**
 * @deprecated Use ZSurveyCalElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyCalQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Cal),
  calUserName: z.string().min(1, { message: "Cal user name is required" }),
  calHost: z.string().optional(),
});

/**
 * @deprecated Use TSurveyCalElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyCalQuestion = z.infer<typeof ZSurveyCalQuestion>;

export const ZSurveyMatrixQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export type TSurveyMatrixQuestionChoice = z.infer<typeof ZSurveyMatrixQuestionChoice>;

/**
 * @deprecated Use ZSurveyMatrixElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyMatrixQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Matrix),
  rows: z.array(ZSurveyMatrixQuestionChoice),
  columns: z.array(ZSurveyMatrixQuestionChoice),
  shuffleOption: ZShuffleOption.optional().default("none"),
});

/**
 * @deprecated Use TSurveyMatrixElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyMatrixQuestion = z.infer<typeof ZSurveyMatrixQuestion>;

const ZToggleInputConfig = z.object({
  show: z.boolean(),
  required: z.boolean(),
  placeholder: ZI18nString,
});

export type TInputFieldConfig = z.infer<typeof ZToggleInputConfig>;

/**
 * @deprecated Use ZSurveyAddressElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyAddressQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Address),
  addressLine1: ZToggleInputConfig,
  addressLine2: ZToggleInputConfig,
  city: ZToggleInputConfig,
  state: ZToggleInputConfig,
  zip: ZToggleInputConfig,
  country: ZToggleInputConfig,
});

/**
 * @deprecated Use ZSurveyContactInfoElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyContactInfoQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.ContactInfo),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
});

/**
 * @deprecated Use TSurveyAddressElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyAddressQuestion = z.infer<typeof ZSurveyAddressQuestion>;

/**
 * @deprecated Use TSurveyContactInfoElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyContactInfoQuestion = z.infer<typeof ZSurveyContactInfoQuestion>;

/**
 * @deprecated Use ZSurveyRankingElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyRankingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Ranking),
  choices: z
    .array(ZSurveyQuestionChoice)
    .min(2, { message: "Ranking Question must have at least two options" })
    .max(25, { message: "Ranking Question can have at most 25 options" }),
  otherOptionPlaceholder: ZI18nString.optional(),
  shuffleOption: ZShuffleOption.optional(),
});

/**
 * @deprecated Use TSurveyRankingElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyRankingQuestion = z.infer<typeof ZSurveyRankingQuestion>;

/**
 * @deprecated Use TSurveyElement instead. Kept for v1 API backward compatibility only.
 */
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
  ZSurveyRankingQuestion,
  ZSurveyContactInfoQuestion,
]);

/**
 * @deprecated Use TSurveyElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyQuestion = z.infer<typeof ZSurveyQuestion>;

/**
 * @deprecated Use TSurveyElement[] instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyQuestions = z.array(ZSurveyQuestion);

/**
 * @deprecated Use TSurveyElement[] instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyQuestions = z.infer<typeof ZSurveyQuestions>;

/**
 * @deprecated Use TSurveyElementTypeEnum instead. Kept for v1 API backward compatibility only.
 */
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
  TSurveyQuestionTypeEnum.Ranking,
  TSurveyQuestionTypeEnum.ContactInfo,
]);

/**
 * @deprecated Use TSurveyElementTypeEnum instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyQuestionType = z.infer<typeof ZSurveyQuestionType>;

export const ZSurveyLanguage = z.object({
  language: ZLanguage,
  default: z.boolean(),
  enabled: z.boolean(),
});

export type TSurveyLanguage = z.infer<typeof ZSurveyLanguage>;

/**
 * @deprecated Kept for v1 API backward compatibility only.
 */
export const ZSurveyQuestionsObject = z.object({
  questions: ZSurveyQuestions,
  hiddenFields: ZSurveyHiddenFields,
});

/**
 * @deprecated Kept for v1 API backward compatibility only.
 */
export type TSurveyQuestionsObject = z.infer<typeof ZSurveyQuestionsObject>;

export const ZSurveyDisplayOption = z.enum([
  "displayOnce",
  "displayMultiple",
  "respondMultiple",
  "displaySome",
]);

export type TSurveyDisplayOption = z.infer<typeof ZSurveyDisplayOption>;

export const ZSurveyType = z.enum(["link", "app"]);

export type TSurveyType = z.infer<typeof ZSurveyType>;

export const ZSurveyStatus = z.enum(["draft", "inProgress", "paused", "completed"]);

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
    // TODO: Remove this once blocks are the single source of truth
    questions: ZSurveyQuestions.default([]).superRefine((questions, ctx) => {
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
    blocks: ZSurveyBlocks.default([]).superRefine((blocks, ctx) => {
      const blockIds = blocks.map((b) => b.id);
      const uniqueBlockIds = new Set(blockIds);
      if (uniqueBlockIds.size !== blockIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Block IDs must be unique",
          path: [blockIds.findIndex((id, index) => blockIds.indexOf(id) !== index), "id"],
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
    followUps: z.array(
      ZSurveyFollowUp.extend({
        deleted: z.boolean().optional(),
      })
    ),
    delay: z.number(),
    autoComplete: z.number().min(1, { message: "Response limit must be greater than 0" }).nullable(),
    projectOverwrites: ZSurveyProjectOverwrites.nullable(),
    styling: ZSurveyStyling.nullable(),
    showLanguageSwitch: z.boolean().nullable(),
    surveyClosedMessage: ZSurveyClosedMessage.nullable(),
    segment: ZSegment.nullable(),
    singleUse: ZSurveySingleUse.nullable(),
    isVerifyEmailEnabled: z.boolean(),
    recaptcha: ZSurveyRecaptcha.nullable(),
    isSingleResponsePerEmailEnabled: z.boolean(),
    isBackButtonHidden: z.boolean(),
    pin: z.string().length(4, { message: "PIN must be a four digit number" }).nullish(),
    displayPercentage: z.number().min(0.01).max(100).nullable(),
    languages: z.array(ZSurveyLanguage),
    metadata: ZSurveyMetadata,
  })
  .superRefine((survey, ctx) => {
    const { questions, blocks, languages, welcomeCard, endings, isBackButtonHidden } = survey;

    // Validate: must have questions OR blocks with elements, not both
    const hasQuestions = questions.length > 0;
    const hasBlocks = blocks.length > 0 && blocks.some((b) => b.elements.length > 0);

    if (!hasQuestions && !hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Survey must have either questions or blocks with elements",
        path: ["questions"],
      });
    }

    if (hasQuestions && hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Survey cannot have both questions and blocks. Use one model.",
        path: ["blocks"],
      });
    }

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

      if (welcomeCard.subheader && welcomeCard.subheader.default.trim() !== "") {
        multiLangIssue = validateCardFieldsForAllLanguages(
          "welcomeCardSubheader",
          welcomeCard.subheader,
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
    if (hasQuestions) {
      questions.forEach((question, questionIndex) => {
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
        const initialFieldsToValidate = ["buttonLabel", "upperLabel", "lowerLabel", "label", "placeholder"];

        let fieldsToValidate =
          questionIndex === 0 || isBackButtonHidden
            ? initialFieldsToValidate
            : [...initialFieldsToValidate, "backButtonLabel"];

        // Skip buttonLabel validation for required NPS and Rating questions
        if (
          (question.type === TSurveyQuestionTypeEnum.NPS ||
            question.type === TSurveyQuestionTypeEnum.Rating) &&
          question.required
        ) {
          fieldsToValidate = fieldsToValidate.filter((field) => field !== "buttonLabel");
        }

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
          question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
          question.type === TSurveyQuestionTypeEnum.Ranking
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
            if (!question.buttonUrl || question.buttonUrl.trim() === "") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question ${String(questionIndex + 1)}: Button URL is required when external button is enabled`,
                path: ["questions", questionIndex, "buttonUrl"],
              });
            } else {
              const parsedButtonUrl = getZSafeUrl.safeParse(question.buttonUrl);
              if (!parsedButtonUrl.success) {
                const errorMessage = parsedButtonUrl.error.issues[0].message;
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Question ${String(questionIndex + 1)}: ${errorMessage}`,
                  path: ["questions", questionIndex, "buttonUrl"],
                });
              }
            }
          }
        }

        if (question.type === TSurveyQuestionTypeEnum.Matrix) {
          question.rows.forEach((row, rowIndex) => {
            multiLangIssue = validateQuestionLabels(
              `Row ${String(rowIndex + 1)}`,
              row.label,
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
              column.label,
              languages,
              questionIndex,
              true
            );
            if (multiLangIssue) {
              ctx.addIssue(multiLangIssue);
            }
          });

          const duplicateRowsLanguageCodes = findLanguageCodesForDuplicateLabels(
            question.rows.map((row) => row.label),
            languages
          );
          const duplicateColumnLanguageCodes = findLanguageCodesForDuplicateLabels(
            question.columns.map((column) => column.label),
            languages
          );

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
            const hostnameRegex = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-)){1,}$/i;
            if (!hostnameRegex.test(question.calHost)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question ${String(questionIndex + 1)} must have a valid host name`,
                path: ["questions", questionIndex, "calHost"],
              });
            }
          }
        }

        if (question.type === TSurveyQuestionTypeEnum.ContactInfo) {
          const { company, email, firstName, lastName, phone } = question;
          const fields = [
            { ...company, label: "Company" },
            { ...email, label: "Email" },
            { ...firstName, label: "First Name" },
            { ...lastName, label: "Last Name" },
            { ...phone, label: "Phone" },
          ];

          if (fields.every((field) => !field.show)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "At least one field must be shown in the Contact Info question",
              path: ["questions", questionIndex],
            });
          }
          fields.forEach((field) => {
            const multiLangIssueInPlaceholder =
              field.show &&
              validateQuestionLabels(
                `Label for field ${field.label}`,
                field.placeholder,
                languages,
                questionIndex,
                true
              );
            if (multiLangIssueInPlaceholder) {
              ctx.addIssue(multiLangIssueInPlaceholder);
            }
          });
        }

        if (question.type === TSurveyQuestionTypeEnum.Address) {
          const { addressLine1, addressLine2, city, state, zip, country } = question;
          const fields = [
            { ...addressLine1, label: "Address Line 1" },
            { ...addressLine2, label: "Address Line 2" },
            { ...city, label: "City" },
            { ...state, label: "State" },
            { ...zip, label: "Zip" },
            { ...country, label: "Country" },
          ];

          if (fields.every((field) => !field.show)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "At least one field must be shown in the Address question",
              path: ["questions", questionIndex],
            });
          }
          fields.forEach((field) => {
            const multiLangIssueInPlaceholder =
              field.show &&
              validateQuestionLabels(
                `Label for field ${field.label}`,
                field.placeholder,
                languages,
                questionIndex,
                true
              );
            if (multiLangIssueInPlaceholder) {
              ctx.addIssue(multiLangIssueInPlaceholder);
            }
          });
        }

        if (question.logic) {
          const logicIssues = validateLogic(survey, questionIndex, question.logic);

          logicIssues.forEach((issue) => {
            ctx.addIssue(issue);
          });
        }
      });

      const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(questions);
      if (questionsWithCyclicLogic.length > 0) {
        questionsWithCyclicLogic.forEach((questionId) => {
          const questionIndex = questions.findIndex((q) => q.id === questionId);
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Cyclic logic detected 🔃 Please check the logic of question ${String(questionIndex + 1)}.`,
            path: ["questions", questionIndex, "logic"],
          });
        });
      }
    }

    // Blocks validation
    if (hasBlocks) {
      // 1. Validate block IDs are unique (CUIDs should be unique by design, but validate anyway)
      const blockIds = blocks.map((b) => b.id);
      const uniqueBlockIds = new Set(blockIds);
      if (uniqueBlockIds.size !== blockIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Block IDs must be unique",
          path: ["blocks", blockIds.findIndex((id, index) => blockIds.indexOf(id) !== index), "id"],
        });
      }

      // 2. Build map of all elements across all blocks
      const allElements = new Map<string, { block: number; element: number; data: TSurveyElement }>();
      blocks.forEach((block, blockIdx) => {
        block.elements.forEach((element, elemIdx) => {
          if (allElements.has(element.id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Element ID "${element.id}" is used in multiple blocks. Element IDs must be unique across all blocks.`,
              path: ["blocks", blockIdx, "elements", elemIdx, "id"],
            });
          }
          allElements.set(element.id, { block: blockIdx, element: elemIdx, data: element });
        });
      });

      // 4. Detailed validation for each block and its elements
      blocks.forEach((block, blockIndex) => {
        // Validate block button labels
        const defaultLanguageCode = "default";

        if (
          block.buttonLabel?.[defaultLanguageCode] &&
          block.buttonLabel[defaultLanguageCode].trim() !== ""
        ) {
          // Validate button label for all enabled languages
          const enabledLanguages = languages.filter((lang) => lang.enabled);
          const languageCodes = enabledLanguages.map((lang) =>
            lang.default ? "default" : lang.language.code
          );

          for (const languageCode of languageCodes.length === 0 ? ["default"] : languageCodes) {
            const labelValue = block.buttonLabel[languageCode];
            if (!labelValue || getTextContent(labelValue).length === 0) {
              const invalidLanguageCode =
                languageCode === "default"
                  ? (languages.find((lang) => lang.default)?.language.code ?? "default")
                  : languageCode;

              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `The buttonLabel in block ${String(blockIndex + 1)} is missing for the following languages: ${invalidLanguageCode}`,
                path: ["blocks", blockIndex, "buttonLabel"],
                params: { invalidLanguageCodes: [invalidLanguageCode] },
              });
            }
          }
        }

        //only validate back button label for blocks other than the first one and if back button is not hidden
        if (
          !isBackButtonHidden &&
          blockIndex > 0 &&
          block.backButtonLabel?.[defaultLanguageCode] &&
          block.backButtonLabel[defaultLanguageCode].trim() !== ""
        ) {
          // Validate back button label for all enabled languages
          const enabledLanguages = languages.filter((lang) => lang.enabled);
          const languageCodes = enabledLanguages.map((lang) =>
            lang.default ? "default" : lang.language.code
          );

          for (const languageCode of languageCodes.length === 0 ? ["default"] : languageCodes) {
            const labelValue = block.backButtonLabel[languageCode];
            if (!labelValue || getTextContent(labelValue).length === 0) {
              const invalidLanguageCode =
                languageCode === "default"
                  ? (languages.find((lang) => lang.default)?.language.code ?? "default")
                  : languageCode;

              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `The backButtonLabel in block ${String(blockIndex + 1)} is missing for the following languages: ${invalidLanguageCode}`,
                path: ["blocks", blockIndex, "backButtonLabel"],
                params: { invalidLanguageCodes: [invalidLanguageCode] },
              });
            }
          }
        }

        // Validate each element in the block
        block.elements.forEach((element, elementIndex) => {
          // Validate headline (required for all elements)
          let elementMultiLangIssue = validateElementLabels(
            "headline",
            element.headline,
            languages,
            blockIndex,
            elementIndex
          );
          if (elementMultiLangIssue) {
            ctx.addIssue(elementMultiLangIssue);
          }

          // Validate subheader if present
          if (element.subheader && element.subheader[defaultLanguageCode].trim() !== "") {
            elementMultiLangIssue = validateElementLabels(
              "subheader",
              element.subheader,
              languages,
              blockIndex,
              elementIndex
            );
            if (elementMultiLangIssue) {
              ctx.addIssue(elementMultiLangIssue);
            }
          }

          // Type-specific validation
          if (element.type === TSurveyElementTypeEnum.OpenText) {
            if (
              element.placeholder &&
              element.placeholder[defaultLanguageCode].trim() !== "" &&
              languages.length > 1
            ) {
              elementMultiLangIssue = validateElementLabels(
                "placeholder",
                element.placeholder,
                languages,
                blockIndex,
                elementIndex
              );
              if (elementMultiLangIssue) {
                ctx.addIssue(elementMultiLangIssue);
              }
            }
          }

          if (
            element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
            element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
            element.type === TSurveyElementTypeEnum.Ranking
          ) {
            element.choices.forEach((choice, choiceIndex) => {
              elementMultiLangIssue = validateElementLabels(
                `Choice ${String(choiceIndex + 1)}`,
                choice.label,
                languages,
                blockIndex,
                elementIndex,
                true
              );
              if (elementMultiLangIssue) {
                elementMultiLangIssue.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  "choices",
                  choiceIndex,
                ];
                ctx.addIssue(elementMultiLangIssue);
              }
            });

            const duplicateChoicesLanguageCodes = findLanguageCodesForDuplicateLabels(
              element.choices.map((choice) => choice.label),
              languages
            );

            if (duplicateChoicesLanguageCodes.length > 0) {
              const invalidLanguageCodes = duplicateChoicesLanguageCodes.map((invalidLanguageCode) =>
                invalidLanguageCode === "default"
                  ? (languages.find((lang) => lang.default)?.language.code ?? "default")
                  : invalidLanguageCode
              );

              const isDefaultOnly =
                invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Element ${String(elementIndex + 1)} in block ${String(blockIndex + 1)} has duplicate choice labels ${isDefaultOnly ? "" : "for the following languages:"}`,
                path: ["blocks", blockIndex, "elements", elementIndex, "choices"],
                params: isDefaultOnly ? undefined : { invalidLanguageCodes },
              });
            }
          }

          if (element.type === TSurveyElementTypeEnum.Consent) {
            elementMultiLangIssue = validateElementLabels(
              "consent.label",
              element.label,
              languages,
              blockIndex,
              elementIndex
            );

            if (elementMultiLangIssue) {
              elementMultiLangIssue.path = ["blocks", blockIndex, "elements", elementIndex, "label"];
              ctx.addIssue(elementMultiLangIssue);
            }
          }

          if (element.type === TSurveyElementTypeEnum.CTA) {
            // Only validate buttonExternal fields when buttonExternal is true
            if (element.buttonExternal) {
              // Validate ctaButtonLabel when buttonExternal is enabled
              elementMultiLangIssue = validateElementLabels(
                "ctaButtonLabel",
                element.ctaButtonLabel ?? {},
                languages,
                blockIndex,
                elementIndex
              );
              if (elementMultiLangIssue) {
                elementMultiLangIssue.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  "ctaButtonLabel",
                ];
                ctx.addIssue(elementMultiLangIssue);
              }

              // Validate buttonUrl when buttonExternal is enabled
              if (!element.buttonUrl || element.buttonUrl.trim() === "") {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Element ${String(elementIndex + 1)} in block ${String(blockIndex + 1)}: Button URL is required when external button is enabled`,
                  path: ["blocks", blockIndex, "elements", elementIndex, "buttonUrl"],
                });
              } else {
                const parsedButtonUrl = getZSafeUrl.safeParse(element.buttonUrl);
                if (!parsedButtonUrl.success) {
                  const errorMessage = parsedButtonUrl.error.issues[0].message;
                  ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Element ${String(elementIndex + 1)} in block ${String(blockIndex + 1)}: ${errorMessage}`,
                    path: ["blocks", blockIndex, "elements", elementIndex, "buttonUrl"],
                  });
                }
              }
            }
          }

          if (element.type === TSurveyElementTypeEnum.Matrix) {
            element.rows.forEach((row, rowIndex) => {
              elementMultiLangIssue = validateElementLabels(
                `Row ${String(rowIndex + 1)}`,
                row.label,
                languages,
                blockIndex,
                elementIndex,
                true
              );
              if (elementMultiLangIssue) {
                elementMultiLangIssue.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  "rows",
                  rowIndex,
                ];
                ctx.addIssue(elementMultiLangIssue);
              }
            });

            element.columns.forEach((column, columnIndex) => {
              elementMultiLangIssue = validateElementLabels(
                `Column ${String(columnIndex + 1)}`,
                column.label,
                languages,
                blockIndex,
                elementIndex,
                true
              );
              if (elementMultiLangIssue) {
                elementMultiLangIssue.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  "columns",
                  columnIndex,
                ];
                ctx.addIssue(elementMultiLangIssue);
              }
            });

            const duplicateRowsLanguageCodes = findLanguageCodesForDuplicateLabels(
              element.rows.map((row) => row.label),
              languages
            );
            const duplicateColumnLanguageCodes = findLanguageCodesForDuplicateLabels(
              element.columns.map((column) => column.label),
              languages
            );

            if (duplicateRowsLanguageCodes.length > 0) {
              const invalidLanguageCodes = duplicateRowsLanguageCodes.map((invalidLanguageCode) =>
                invalidLanguageCode === "default"
                  ? (languages.find((lang) => lang.default)?.language.code ?? "default")
                  : invalidLanguageCode
              );

              const isDefaultOnly =
                invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)} has duplicate row labels ${isDefaultOnly ? "" : "for the following languages:"}`,
                path: ["blocks", blockIndex, "elements", elementIndex, "rows"],
                params: isDefaultOnly ? undefined : { invalidLanguageCodes },
              });
            }

            if (duplicateColumnLanguageCodes.length > 0) {
              const invalidLanguageCodes = duplicateColumnLanguageCodes.map((invalidLanguageCode) =>
                invalidLanguageCode === "default"
                  ? (languages.find((lang) => lang.default)?.language.code ?? "default")
                  : invalidLanguageCode
              );

              const isDefaultOnly =
                invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)} has duplicate column labels ${isDefaultOnly ? "" : "for the following languages:"}`,
                path: ["blocks", blockIndex, "elements", elementIndex, "columns"],
                params: isDefaultOnly ? undefined : { invalidLanguageCodes },
              });
            }
          }

          if (element.type === TSurveyElementTypeEnum.FileUpload) {
            if (element.allowedFileExtensions && element.allowedFileExtensions.length === 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)} must have atleast one allowed file extension`,
                path: ["blocks", blockIndex, "elements", elementIndex, "allowedFileExtensions"],
              });
            }
          }

          if (element.type === TSurveyElementTypeEnum.Cal) {
            if (element.calHost !== undefined) {
              const hostnameRegex = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-)){1,}$/i;
              if (!hostnameRegex.test(element.calHost)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `Question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)} must have a valid host name`,
                  path: ["blocks", blockIndex, "elements", elementIndex, "calHost"],
                });
              }
            }
          }

          if (element.type === TSurveyElementTypeEnum.ContactInfo) {
            const { company, email, firstName, lastName, phone } = element;
            const fields = [
              { ...company, label: "Company" },
              { ...email, label: "Email" },
              { ...firstName, label: "First Name" },
              { ...lastName, label: "Last Name" },
              { ...phone, label: "Phone" },
            ];

            if (fields.every((field) => !field.show)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `At least one field must be shown in the Contact Info question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "elements", elementIndex],
              });
            }
            fields.forEach((field) => {
              const multiLangIssueInPlaceholder =
                field.show &&
                validateElementLabels(
                  `Label for field ${field.label}`,
                  field.placeholder,
                  languages,
                  blockIndex,
                  elementIndex,
                  true
                );
              if (multiLangIssueInPlaceholder) {
                multiLangIssueInPlaceholder.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  field.label.toLowerCase().replace(" ", ""),
                ];
                ctx.addIssue(multiLangIssueInPlaceholder);
              }
            });
          }

          if (element.type === TSurveyElementTypeEnum.Address) {
            const { addressLine1, addressLine2, city, state, zip, country } = element;
            const fields = [
              { ...addressLine1, label: "Address Line 1" },
              { ...addressLine2, label: "Address Line 2" },
              { ...city, label: "City" },
              { ...state, label: "State" },
              { ...zip, label: "Zip" },
              { ...country, label: "Country" },
            ];

            if (fields.every((field) => !field.show)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `At least one field must be shown in the Address question ${String(elementIndex + 1)} in block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "elements", elementIndex],
              });
            }
            fields.forEach((field) => {
              const multiLangIssueInPlaceholder =
                field.show &&
                validateElementLabels(
                  `Label for field ${field.label}`,
                  field.placeholder,
                  languages,
                  blockIndex,
                  elementIndex,
                  true
                );
              if (multiLangIssueInPlaceholder) {
                multiLangIssueInPlaceholder.path = [
                  "blocks",
                  blockIndex,
                  "elements",
                  elementIndex,
                  field.label.toLowerCase().replace(/ /g, ""),
                ];
                ctx.addIssue(multiLangIssueInPlaceholder);
              }
            });
          }
        });

        // Validate block logic (conditions, actions, fallback)
        const logicIssues = validateBlockLogic(survey, blockIndex, block, allElements);
        logicIssues.forEach((issue) => {
          ctx.addIssue(issue);
        });
      });

      // 5. Check for cyclic logic in blocks
      const blocksWithCyclicLogic = findBlocksWithCyclicLogic(blocks);
      if (blocksWithCyclicLogic.length > 0) {
        blocksWithCyclicLogic.forEach((blockId) => {
          const blockIndex = blocks.findIndex((b) => b.id === blockId);
          if (blockIndex !== -1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Cyclic logic detected in block ${String(blockIndex + 1)} (${blocks[blockIndex].name}).`,
              path: ["blocks", blockIndex, "logic"],
            });
          }
        });
      }
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

        if (ending.buttonLabel !== undefined || ending.buttonLink !== undefined) {
          if (!ending.buttonLabel) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Ending card ${String(index + 1)}: Button label cannot be empty`,
              path: ["endings", index, "buttonLabel"],
            });
          } else {
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

          if (!ending.buttonLink || ending.buttonLink.trim() === "") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Ending card ${String(index + 1)}: Button link cannot be empty`,
              path: ["endings", index, "buttonLink"],
            });
          } else {
            const parsedButtonLink = getZSafeUrl.safeParse(ending.buttonLink);
            if (!parsedButtonLink.success) {
              const errorMessage = parsedButtonLink.error.issues[0].message;
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Ending card ${String(index + 1)}: ${errorMessage}`,
                path: ["endings", index, "buttonLink"],
              });
            }
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

        // Validate redirect URL
        if (!ending.url || ending.url.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Ending card ${String(index + 1)}: Redirect URL cannot be empty`,
            path: ["endings", index, "url"],
          });
        } else {
          const parsedUrl = getZSafeUrl.safeParse(ending.url);
          if (!parsedUrl.success) {
            const errorMessage = parsedUrl.error.issues[0].message;
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Ending card ${String(index + 1)}: ${errorMessage}`,
              path: ["endings", index, "url"],
            });
          }
        }
      }
    });

    if (survey.followUps.length) {
      const questionsFromBlocks = survey.blocks.flatMap((block: TSurveyBlock) => block.elements);

      survey.followUps
        .filter((followUp) => !followUp.deleted)
        .forEach((followUp, index) => {
          if (followUp.action.properties.to) {
            const validOptions = [
              ...questionsFromBlocks
                .filter((q) => {
                  if (q.type === TSurveyElementTypeEnum.OpenText) {
                    if (q.inputType === "email") {
                      return true;
                    }
                  }

                  if (q.type === TSurveyElementTypeEnum.ContactInfo) {
                    return q.email.show;
                  }

                  return false;
                })
                .map((q) => q.id),
              ...(survey.hiddenFields.fieldIds ?? []),
            ];

            if (validOptions.findIndex((option) => option === followUp.action.properties.to) === -1) {
              // not from a valid option within the survey, but it could be a correct email from the team member emails or the user's email:
              const parsedEmailTo = z.string().email().safeParse(followUp.action.properties.to);
              if (!parsedEmailTo.success) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `The action in follow up ${String(index + 1)} has an invalid email field`,
                  path: ["followUps"],
                });
              }
            }

            if (followUp.trigger.type === "endings") {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- endingIds is always defined
              if (!followUp.trigger.properties?.endingIds?.length) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: `The trigger in follow up ${String(index + 1)} has no ending selected`,
                  path: ["followUps"],
                });
              }
            }
          }
        });
    }
  });

const isInvalidOperatorsForQuestionType = (
  question: TSurveyQuestion,
  operator: TSurveyLogicConditionsOperator
): boolean => {
  let isInvalidOperator = false;

  const questionType = question.type;

  if (question.required && operator === "isSkipped") return true;

  switch (questionType) {
    case TSurveyQuestionTypeEnum.OpenText:
      switch (question.inputType) {
        case "email":
        case "phone":
        case "text":
        case "url":
          if (
            ![
              "equals",
              "doesNotEqual",
              "contains",
              "doesNotContain",
              "startsWith",
              "doesNotStartWith",
              "endsWith",
              "doesNotEndWith",
              "isSubmitted",
              "isSkipped",
            ].includes(operator)
          ) {
            isInvalidOperator = true;
          }
          break;
        case "number":
          if (
            ![
              "equals",
              "doesNotEqual",
              "isGreaterThan",
              "isLessThan",
              "isGreaterThanOrEqual",
              "isLessThanOrEqual",
              "isSubmitted",
              "isSkipped",
            ].includes(operator)
          ) {
            isInvalidOperator = true;
          }
      }
      break;
    case TSurveyQuestionTypeEnum.MultipleChoiceSingle:
      if (!["equals", "doesNotEqual", "equalsOneOf", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.MultipleChoiceMulti:
    case TSurveyQuestionTypeEnum.PictureSelection:
      if (
        ![
          "equals",
          "doesNotEqual",
          "includesAllOf",
          "includesOneOf",
          "doesNotIncludeAllOf",
          "doesNotIncludeOneOf",
          "isSubmitted",
          "isSkipped",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.NPS:
    case TSurveyQuestionTypeEnum.Rating:
      if (
        ![
          "equals",
          "doesNotEqual",
          "isGreaterThan",
          "isLessThan",
          "isGreaterThanOrEqual",
          "isLessThanOrEqual",
          "isSubmitted",
          "isSkipped",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.CTA:
      if (!["isClicked", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.Consent:
      if (!["isAccepted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.Date:
      if (!["equals", "doesNotEqual", "isBefore", "isAfter", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.FileUpload:
    case TSurveyQuestionTypeEnum.Address:
    case TSurveyQuestionTypeEnum.Ranking:
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.Cal:
      if (!["isBooked", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.Matrix:
      if (
        ![
          "isPartiallySubmitted",
          "isCompletelySubmitted",
          "isSkipped",
          "isEmpty",
          "isNotEmpty",
          "isAnyOf",
          "equals",
          "doesNotEqual",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyQuestionTypeEnum.ContactInfo:
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    default:
      isInvalidOperator = true;
  }

  return isInvalidOperator;
};

const isInvalidOperatorsForVariableType = (
  variableType: "text" | "number",
  operator: TSurveyLogicConditionsOperator
): boolean => {
  let isInvalidOperator = false;

  switch (variableType) {
    case "text":
      if (
        ![
          "equals",
          "doesNotEqual",
          "contains",
          "doesNotContain",
          "startsWith",
          "doesNotStartWith",
          "endsWith",
          "doesNotEndWith",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case "number":
      if (
        ![
          "equals",
          "doesNotEqual",
          "isGreaterThan",
          "isLessThan",
          "isGreaterThanOrEqual",
          "isLessThanOrEqual",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
  }

  return isInvalidOperator;
};

const isInvalidOperatorsForHiddenFieldType = (operator: TSurveyLogicConditionsOperator): boolean => {
  let isInvalidOperator = false;

  if (
    ![
      "equals",
      "doesNotEqual",
      "contains",
      "doesNotContain",
      "startsWith",
      "doesNotStartWith",
      "endsWith",
      "doesNotEndWith",
      "isSet",
      "isNotSet",
    ].includes(operator)
  ) {
    isInvalidOperator = true;
  }

  return isInvalidOperator;
};

const validateConditions = (
  survey: TSurvey,
  questionIndex: number,
  logicIndex: number,
  conditions: TConditionGroupDeprecated
): z.ZodIssue[] => {
  const issues: z.ZodIssue[] = [];

  const validateSingleCondition = (condition: TSingleConditionDeprecated): void => {
    const { leftOperand, operator, rightOperand } = condition;

    // Validate left operand
    if (leftOperand.type === "question") {
      const questionId = leftOperand.value;
      const questionIdx = survey.questions.findIndex((q) => q.id === questionId);
      const question = questionIdx !== -1 ? survey.questions[questionIdx] : undefined;

      if (!question) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
        return;
      } else if (questionIndex < questionIdx) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Question ${String(questionIndex + 1)} cannot refer to a question ${String(questionIdx + 1)} that appears later in the survey`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
        return;
      }

      // Validate operator based on question type
      const isInvalidOperator = isInvalidOperatorsForQuestionType(question, operator);
      if (isInvalidOperator) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Invalid operator "${operator}" for question type "${question.type}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      }

      // Validate right operand
      if (
        [
          "isSubmitted",
          "isSkipped",
          "isClicked",
          "isAccepted",
          "isBooked",
          "isPartiallySubmitted",
          "isCompletelySubmitted",
          "isEmpty",
          "isNotEmpty",
        ].includes(operator)
      ) {
        if (rightOperand !== undefined) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should not be defined for operator "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
        return;
      }

      if (question.type === TSurveyQuestionTypeEnum.OpenText) {
        // Validate right operand
        if (rightOperand?.type === "question") {
          const quesId = rightOperand.value;
          const ques = survey.questions.find((q) => q.id === quesId);

          if (!ques) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const validQuestionTypes = [TSurveyQuestionTypeEnum.OpenText];

            if (question.inputType === "number") {
              validQuestionTypes.push(...[TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS]);
            }

            if (["equals", "doesNotEqual"].includes(condition.operator)) {
              if (question.inputType !== "number") {
                validQuestionTypes.push(
                  ...[
                    TSurveyQuestionTypeEnum.Date,
                    TSurveyQuestionTypeEnum.MultipleChoiceSingle,
                    TSurveyQuestionTypeEnum.MultipleChoiceMulti,
                  ]
                );
              }
            }

            if (!validQuestionTypes.includes(ques.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${ques.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

          if (!field) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (!rightOperand.value) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Static value is required in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) {
        if (rightOperand?.type !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const choice = question.choices.find((c) => c.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice with label "${rightOperand.value}" does not exist in question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (condition.operator === "equalsOneOf") {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: z.ZodIssueCode.custom,
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
                });
              }
            });

            const choices = question.choices.map((c) => c.id);

            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choices selected in right operand does not exist in the choices of the question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      } else if (
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
        question.type === TSurveyQuestionTypeEnum.PictureSelection
      ) {
        if (rightOperand?.type !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be amongst the choice values for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const choice = question.choices.find((c) => c.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice with label "${rightOperand.value}" does not exist in question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (
          ["includesAllOf", "includesOneOf", "doesNotIncludeAllOf", "doesNotIncludeOneOf"].includes(
            condition.operator
          )
        ) {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: z.ZodIssueCode.custom,
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
                });
              }
            });

            const choices = question.choices.map((c) => c.id);

            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choices selected in right operand does not exist in the choices of the question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      } else if (
        question.type === TSurveyQuestionTypeEnum.NPS ||
        question.type === TSurveyQuestionTypeEnum.Rating
      ) {
        if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be number in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (typeof rightOperand.value !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a number for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (question.type === TSurveyQuestionTypeEnum.NPS) {
            if (rightOperand.value < 0 || rightOperand.value > 10) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: NPS score should be between 0 and 10 for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          } else if (rightOperand.value < 1 || rightOperand.value > question.range) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Rating value should be between 1 and ${String(question.range)} for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a variable or a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
      } else if (question.type === TSurveyQuestionTypeEnum.Date) {
        if (rightOperand?.type === "question") {
          const quesId = rightOperand.value;
          const ques = survey.questions.find((q) => q.id === quesId);

          if (!ques) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const validQuestionTypes = [TSurveyQuestionTypeEnum.OpenText, TSurveyQuestionTypeEnum.Date];
            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "text") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const doesFieldExists = survey.hiddenFields.fieldIds?.includes(fieldId);

          if (!doesFieldExists) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          const date = rightOperand.value as string;

          if (!date) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Please select a date value in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (isNaN(new Date(date).getTime())) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid date format for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (question.type === TSurveyQuestionTypeEnum.Matrix) {
        const row = leftOperand.meta?.row;
        if (row === undefined) {
          if (rightOperand?.value !== undefined) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand is not allowed in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (!["isPartiallySubmitted", "isCompletelySubmitted"].includes(operator)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Operator "${operator}" is not allowed in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          if (rightOperand === undefined) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand is required in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (rightOperand) {
            if (rightOperand.type !== "static") {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Right operand should be a static value in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
            const rowIndex = Number(row);
            if (rowIndex < 0 || rowIndex >= question.rows.length) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid row index in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      }
    } else if (leftOperand.type === "variable") {
      const variableId = leftOperand.value;
      const variable = survey.variables.find((v) => v.id === variableId);
      if (!variable) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      } else {
        // Validate operator based on variable type
        const isInvalidOperator = isInvalidOperatorsForVariableType(variable.type, operator);
        if (isInvalidOperator) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid operator "${operator}" for variable ${variable.name} of type "${variable.type}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }

        // Validate right operand
        if (rightOperand?.type === "question") {
          const questionId = rightOperand.value;
          const question = survey.questions.find((q) => q.id === questionId);

          if (!question) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type === "number") {
            const validQuestionTypes = [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS];
            if (
              !validQuestionTypes.includes(question.type) &&
              question.type === TSurveyQuestionTypeEnum.OpenText &&
              question.inputType !== "number"
            ) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          } else {
            const validQuestionTypes = [
              TSurveyQuestionTypeEnum.OpenText,
              TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            ];

            if (["equals", "doesNotEqual"].includes(operator)) {
              validQuestionTypes.push(
                TSurveyQuestionTypeEnum.MultipleChoiceMulti,
                TSurveyQuestionTypeEnum.Date
              );
            }

            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (rightOperand?.type === "variable") {
          const id = rightOperand.value;
          const foundVariable = survey.variables.find((v) => v.id === id);

          if (!foundVariable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== foundVariable.type) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type mismatch in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

          if (!field) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      }
    } else {
      const hiddenFieldId = leftOperand.value;
      const hiddenField = survey.hiddenFields.fieldIds?.find((fieldId) => fieldId === hiddenFieldId);

      if (!hiddenField) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Hidden field ID ${hiddenFieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      }

      // Validate operator based on hidden field type
      const isInvalidOperator = isInvalidOperatorsForHiddenFieldType(operator);
      if (isInvalidOperator) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Invalid operator "${operator}" for hidden field in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      }

      // Validate right operand
      if (rightOperand?.type === "question") {
        const questionId = rightOperand.value;
        const question = survey.questions.find((q) => q.id === questionId);

        if (!question) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else {
          const validQuestionTypes = [
            TSurveyQuestionTypeEnum.OpenText,
            TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          ];

          if (["equals", "doesNotEqual"].includes(condition.operator)) {
            validQuestionTypes.push(
              TSurveyQuestionTypeEnum.MultipleChoiceMulti,
              TSurveyQuestionTypeEnum.Date
            );
          }

          if (!validQuestionTypes.includes(question.type)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (rightOperand?.type === "variable") {
        const variableId = rightOperand.value;
        const variable = survey.variables.find((v) => v.id === variableId);

        if (!variable) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (variable.type !== "text") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
      } else if (rightOperand?.type === "hiddenField") {
        const fieldId = rightOperand.value;
        const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

        if (!field) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
      }
    }
  };

  const validateConditionGroup = (group: TConditionGroup | TConditionGroupDeprecated): void => {
    group.conditions.forEach((condition) => {
      // Check if it's a group by checking for "conditions" property
      if ("conditions" in condition && "connector" in condition) {
        validateConditionGroup(condition as TConditionGroup | TConditionGroupDeprecated);
      } else {
        validateSingleCondition(condition as TSingleCondition);
      }
    });
  };

  validateConditionGroup(conditions);

  return issues;
};

const validateActions = (
  survey: TSurvey,
  questionIndex: number,
  logicIndex: number,
  actions: TSurveyLogicAction[]
): z.ZodIssue[] => {
  const previousQuestions = survey.questions.filter((_, idx) => idx <= questionIndex);
  const nextQuestions = survey.questions.filter((_, idx) => idx >= questionIndex);
  const nextQuestionsIds = nextQuestions.map((q) => q.id);

  const actionIssues: (z.ZodIssue | undefined)[] = actions.map((action) => {
    if (action.objective === "calculate") {
      const variable = survey.variables.find((v) => v.id === action.variableId);

      if (!variable) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${action.variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex],
        };
      }

      if (action.value.type === "variable") {
        const selectedVariable = survey.variables.find((v) => v.id === action.value.value);

        if (!selectedVariable || selectedVariable.type !== variable.type) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid variable type for variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }
      }

      if (variable.type === "text") {
        const textVariableParseData = ZActionCalculateText.safeParse(action);
        if (!textVariableParseData.success) {
          return {
            code: z.ZodIssueCode.custom,
            message: textVariableParseData.error.errors[0].message,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }

        if (action.value.type === "question") {
          const allowedQuestions = [
            TSurveyQuestionTypeEnum.OpenText,
            TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            TSurveyQuestionTypeEnum.Rating,
            TSurveyQuestionTypeEnum.NPS,
            TSurveyQuestionTypeEnum.Date,
          ];

          const selectedQuestion = survey.questions.find((q) => q.id === action.value.value);

          if (!selectedQuestion || !allowedQuestions.includes(selectedQuestion.type)) {
            return {
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid question type for text variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex],
            };
          }
        }

        return undefined;
      }

      const numberVariableParseData = ZActionCalculateNumber.safeParse(action);
      if (!numberVariableParseData.success) {
        return {
          code: z.ZodIssueCode.custom,
          message: numberVariableParseData.error.errors[0].message,
          path: ["questions", questionIndex, "logic", logicIndex],
        };
      }

      if (action.value.type === "question") {
        const allowedQuestions = [TSurveyQuestionTypeEnum.Rating, TSurveyQuestionTypeEnum.NPS];

        const selectedQuestion = previousQuestions.find((q) => q.id === action.value.value);

        if (
          !selectedQuestion ||
          (!allowedQuestions.includes(selectedQuestion.type) &&
            selectedQuestion.type === TSurveyQuestionTypeEnum.OpenText &&
            selectedQuestion.inputType !== "number")
        ) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid question type for number variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }
      }
    } else {
      const endingIds = survey.endings.map((ending) => ending.id);

      const possibleQuestionIds =
        action.objective === "jumpToQuestion" ? [...nextQuestionsIds, ...endingIds] : nextQuestionsIds;

      if (!possibleQuestionIds.includes(action.target)) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Question ID ${action.target} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic"],
        };
      }

      if (action.objective === "requireAnswer") {
        const optionalQuestionIds = nextQuestions
          .filter((question) => !question.required)
          .map((question) => question.id);

        if (!optionalQuestionIds.includes(action.target)) {
          const quesIdx = survey.questions.findIndex((q) => q.id === action.target);

          return {
            code: z.ZodIssueCode.custom,
            message: `Question ${String(quesIdx + 1)} is already required in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }
      }
    }

    return undefined;
  });

  const jumpToQuestionActions = actions.filter((action) => action.objective === "jumpToQuestion");
  if (jumpToQuestionActions.length > 1) {
    actionIssues.push({
      code: z.ZodIssueCode.custom,
      message: `Conditional Logic: Multiple jump actions are not allowed in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
      path: ["questions", questionIndex, "logic"],
    });
  }

  const filteredActionIssues = actionIssues.filter((issue): issue is ZodIssue => issue !== undefined);
  return filteredActionIssues;
};

const validateLogicFallback = (survey: TSurvey, questionIdx: number): z.ZodIssue[] | undefined => {
  const question = survey.questions[questionIdx];

  if (!question.logicFallback) return;

  if (!question.logic?.length && question.logicFallback) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback logic is defined without any logic in question ${String(questionIdx + 1)}`,
        path: ["questions", questionIdx],
      },
    ];
  } else if (question.id === question.logicFallback) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback logic is defined with the same question in question ${String(questionIdx + 1)}`,
        path: ["questions", questionIdx],
      },
    ];
  }

  const possibleFallbackIds: string[] = [];

  survey.questions.forEach((q, idx) => {
    if (idx !== questionIdx) {
      possibleFallbackIds.push(q.id);
    }
  });

  survey.endings.forEach((e) => {
    possibleFallbackIds.push(e.id);
  });

  if (!possibleFallbackIds.includes(question.logicFallback)) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback question ID ${question.logicFallback} does not exist in question ${String(questionIdx + 1)}`,
        path: ["questions", questionIdx],
      },
    ];
  }
};

const validateLogic = (
  survey: TSurvey,
  questionIndex: number,
  logic: TSurveyLogicDeprecated[]
): z.ZodIssue[] => {
  const logicFallbackIssue = validateLogicFallback(survey, questionIndex);

  const logicIssues = logic.map((logicItem, logicIndex) => {
    return [
      ...validateConditions(survey, questionIndex, logicIndex, logicItem.conditions),
      ...validateActions(survey, questionIndex, logicIndex, logicItem.actions),
    ];
  });

  return [...logicIssues.flat(), ...(logicFallbackIssue ?? [])];
};

// ================== BLOCK LOGIC VALIDATION ==================

const isInvalidOperatorsForElementType = (
  element: TSurveyElement,
  operator: TSurveyLogicConditionsOperator
): boolean => {
  let isInvalidOperator = false;

  const elementType = element.type;

  if (element.required && operator === "isSkipped") return true;

  switch (elementType) {
    case TSurveyElementTypeEnum.OpenText:
      switch (element.inputType) {
        case "email":
        case "phone":
        case "text":
        case "url":
          if (
            ![
              "equals",
              "doesNotEqual",
              "contains",
              "doesNotContain",
              "startsWith",
              "doesNotStartWith",
              "endsWith",
              "doesNotEndWith",
              "isSubmitted",
              "isSkipped",
            ].includes(operator)
          ) {
            isInvalidOperator = true;
          }
          break;
        case "number":
          if (
            ![
              "equals",
              "doesNotEqual",
              "isLessThan",
              "isLessThanOrEqual",
              "isGreaterThan",
              "isGreaterThanOrEqual",
              "isSubmitted",
              "isSkipped",
            ].includes(operator)
          ) {
            isInvalidOperator = true;
          }
          break;
      }
      break;
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      if (!["equals", "doesNotEqual", "equalsOneOf", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.PictureSelection:
      if (
        ![
          "equals",
          "doesNotEqual",
          "includesAllOf",
          "includesOneOf",
          "doesNotIncludeAllOf",
          "doesNotIncludeOneOf",
          "isSubmitted",
          "isSkipped",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Ranking:
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Rating:
      if (
        ![
          "equals",
          "doesNotEqual",
          "isLessThan",
          "isLessThanOrEqual",
          "isGreaterThan",
          "isGreaterThanOrEqual",
          "isSubmitted",
          "isSkipped",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.CTA:
      if (!["isClicked", "isNotClicked"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Consent:
      if (!["isAccepted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Cal:
      if (!["isBooked", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.FileUpload:
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Date:
      if (!["equals", "doesNotEqual", "isBefore", "isAfter", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Matrix:
      if (
        ![
          "isPartiallySubmitted",
          "isCompletelySubmitted",
          "isSkipped",
          "isEmpty",
          "isNotEmpty",
          "isAnyOf",
          "equals",
          "doesNotEqual",
        ].includes(operator)
      ) {
        isInvalidOperator = true;
      }
      break;
    case TSurveyElementTypeEnum.Address:
    case TSurveyElementTypeEnum.ContactInfo:
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
  }

  return isInvalidOperator;
};

const validateBlockConditions = (
  survey: TSurvey,
  blockIndex: number,
  logicIndex: number,
  conditions: TConditionGroup,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.ZodIssue[] => {
  const issues: z.ZodIssue[] = [];

  const validateSingleCondition = (condition: TSingleCondition): void => {
    const { leftOperand, operator, rightOperand } = condition;

    // Validate left operand
    if (leftOperand.type === "element") {
      const elementId = leftOperand.value;
      const elementInfo = allElements.get(elementId);

      if (!elementInfo) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Element Id ${elementId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
        return;
      } else if (blockIndex < elementInfo.block) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Block ${String(blockIndex + 1)} cannot refer to an element in block ${String(elementInfo.block + 1)} that appears later in the survey`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
        return;
      }

      const element = elementInfo.data;

      // Validate operator based on element type
      const isInvalidOperator = isInvalidOperatorsForElementType(element, operator);
      if (isInvalidOperator) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Invalid operator "${operator}" for element type "${element.type}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
      }

      // Validate CTA elements: CTAs without external buttons cannot be used in logic
      if (element.type === TSurveyElementTypeEnum.CTA && !element.buttonExternal) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: CTA element "${elementId}" does not have an external button and cannot be used in logic conditions in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
        return;
      }

      // Validate right operand
      if (
        [
          "isSubmitted",
          "isSkipped",
          "isClicked",
          "isNotClicked",
          "isAccepted",
          "isBooked",
          "isPartiallySubmitted",
          "isCompletelySubmitted",
          "isEmpty",
          "isNotEmpty",
        ].includes(operator)
      ) {
        if (rightOperand !== undefined) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should not be defined for operator "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
          });
        }
        return;
      }

      if (element.type === TSurveyElementTypeEnum.OpenText) {
        // Validate right operand
        if (rightOperand?.type === "element") {
          const elemId = rightOperand.value;
          const elem = allElements.get(elemId);

          if (!elem) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Element ID ${elemId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const validElementTypes = [TSurveyElementTypeEnum.OpenText];

            if (element.inputType === "number") {
              validElementTypes.push(...[TSurveyElementTypeEnum.Rating, TSurveyElementTypeEnum.NPS]);
            }

            if (["equals", "doesNotEqual"].includes(condition.operator)) {
              if (element.inputType !== "number") {
                validElementTypes.push(
                  ...[
                    TSurveyElementTypeEnum.Date,
                    TSurveyElementTypeEnum.MultipleChoiceSingle,
                    TSurveyElementTypeEnum.MultipleChoiceMulti,
                  ]
                );
              }
            }

            if (!validElementTypes.includes(elem.data.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid element type "${elem.data.type}" for right operand in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

          if (!field) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (!rightOperand.value) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Static value is required in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
        if (rightOperand?.type !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            // Validate that the choice ID exists in the element's choices
            const choiceMatch = element.choices.find((c) => c.id === rightOperand.value);
            if (!choiceMatch) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice "${rightOperand.value}" does not exist in element ${String(elementInfo.element + 1)} of block ${String(elementInfo.block + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      } else if (
        element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
        element.type === TSurveyElementTypeEnum.PictureSelection ||
        element.type === TSurveyElementTypeEnum.Ranking
      ) {
        if (rightOperand?.type !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            // Validate that the choice ID exists in the element's choices
            const choiceMatch = element.choices.find((c) => c.id === rightOperand.value);
            if (!choiceMatch) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice "${rightOperand.value}" does not exist in element ${String(elementInfo.element + 1)} of block ${String(elementInfo.block + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (
          ["includesAllOf", "includesOneOf", "doesNotIncludeAllOf", "doesNotIncludeOneOf"].includes(
            condition.operator
          )
        ) {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: z.ZodIssueCode.custom,
                  message: `Conditional Logic: Each value in the right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                  path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
                });
              }
            });

            // Validate that all choice IDs exist in the element's choices
            const choiceIds = element.choices.map((c) => c.id);
            if (rightOperand.value.some((value) => !choiceIds.includes(value))) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: One or more choices selected in right operand do not exist in the element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      } else if (
        element.type === TSurveyElementTypeEnum.NPS ||
        element.type === TSurveyElementTypeEnum.Rating
      ) {
        if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be number in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (typeof rightOperand.value !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a number for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else if (element.type === TSurveyElementTypeEnum.NPS) {
            if (rightOperand.value < 0 || rightOperand.value > 10) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: NPS score should be between 0 and 10 for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          } else if (rightOperand.value < 1 || rightOperand.value > element.range) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Rating value should be between 1 and ${String(element.range)} for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a variable or a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
          });
        }
      } else if (element.type === TSurveyElementTypeEnum.Date) {
        if (rightOperand?.type === "element") {
          const elemId = rightOperand.value;
          const elem = allElements.get(elemId);

          if (!elem) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Element ID ${elemId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const validElementTypes = [TSurveyElementTypeEnum.OpenText, TSurveyElementTypeEnum.Date];
            if (!validElementTypes.includes(elem.data.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid element type "${elem.data.type}" for right operand in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (rightOperand?.type === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v) => v.id === variableId);

          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "text") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const doesFieldExists = survey.hiddenFields.fieldIds?.includes(fieldId);

          if (!doesFieldExists) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          const date = rightOperand.value as string;

          if (!date) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Please select a date value in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          } else if (isNaN(new Date(date).getTime())) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid date format for right operand in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (element.type === TSurveyElementTypeEnum.Matrix) {
        const row = leftOperand.meta?.row;
        if (row === undefined) {
          if (rightOperand?.value !== undefined) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand is not allowed in matrix element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (!["isPartiallySubmitted", "isCompletelySubmitted"].includes(operator)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Operator "${operator}" is not allowed in matrix element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          if (rightOperand === undefined) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand is required in matrix element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (rightOperand) {
            if (rightOperand.type !== "static") {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Right operand should be a static value in matrix element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
            const rowIndex = Number(row);
            if (rowIndex < 0 || rowIndex >= element.rows.length) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid row index in matrix element in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
                path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        }
      }
    } else if (leftOperand.type === "variable") {
      const variableId = leftOperand.value;
      const variable = survey.variables.find((v) => v.id === variableId);

      if (!variable) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
        return;
      }

      if (rightOperand?.type === "variable") {
        const rightVariableId = rightOperand.value;
        const rightVariable = survey.variables.find((v) => v.id === rightVariableId);

        if (!rightVariable) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Variable ID ${rightVariableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
          });
        }
      }
    } else {
      // leftOperand.type === "hiddenField"
      const fieldId = leftOperand.value;
      const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

      if (!field) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
        });
      }
    }
  };

  const processConditionGroup = (group: TConditionGroup): void => {
    if (isConditionGroup(group)) {
      group.conditions.forEach((condition) => {
        if (isConditionGroup(condition)) {
          processConditionGroup(condition);
        } else {
          validateSingleCondition(condition);
        }
      });
    } else {
      validateSingleCondition(group);
    }
  };

  processConditionGroup(conditions);
  return issues;
};

const validateBlockActions = (
  survey: TSurvey,
  blockIndex: number,
  logicIndex: number,
  actions: TSurveyBlockLogicAction[],
  currentBlock: TSurveyBlock,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.ZodIssue[] => {
  const actionIssues: (z.ZodIssue | undefined)[] = actions.map((action) => {
    if (action.objective === "calculate") {
      const variable = survey.variables.find((v) => v.id === action.variableId);

      if (!variable) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${action.variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }

      if (action.value.type === "variable") {
        const selectedVariable = survey.variables.find((v) => v.id === action.value.value);

        if (!selectedVariable || selectedVariable.type !== variable.type) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid variable type for variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex],
          };
        }
      }

      if (variable.type === "text") {
        if (action.value.type === "element") {
          const allowedElements = [
            TSurveyElementTypeEnum.OpenText,
            TSurveyElementTypeEnum.MultipleChoiceSingle,
            TSurveyElementTypeEnum.Rating,
            TSurveyElementTypeEnum.NPS,
            TSurveyElementTypeEnum.Date,
          ];

          const selectedElement = allElements.get(action.value.value);

          if (!selectedElement || !allowedElements.includes(selectedElement.data.type)) {
            return {
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid element type for text variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
              path: ["blocks", blockIndex, "logic", logicIndex],
            };
          }
        }

        return undefined;
      }

      if (action.value.type === "element") {
        const allowedElements = [TSurveyElementTypeEnum.Rating, TSurveyElementTypeEnum.NPS];

        const selectedElement = allElements.get(action.value.value);

        if (
          !selectedElement ||
          (!allowedElements.includes(selectedElement.data.type) &&
            selectedElement.data.type === TSurveyElementTypeEnum.OpenText &&
            selectedElement.data.inputType !== "number")
        ) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid element type for number variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
            path: ["blocks", blockIndex, "logic", logicIndex],
          };
        }
      }
    } else if (action.objective === "requireAnswer") {
      // requireAnswer must target an element OUTSIDE the current block (in a future block)
      const targetElementId = action.target;
      const targetElementInfo = allElements.get(targetElementId);

      if (!targetElementInfo) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Element ID ${targetElementId} does not exist for requireAnswer action in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }

      // Check if element is in the current block (not allowed)
      if (targetElementInfo.block === blockIndex) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Element ${targetElementId} cannot be in the current block for requireAnswer action in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}. RequireAnswer must target elements in other blocks.`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }

      // Check if element is in a previous block (should target future blocks)
      if (targetElementInfo.block < blockIndex) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Element ${targetElementId} is in a previous block (block ${String(targetElementInfo.block + 1)}). RequireAnswer should target elements in future blocks after block ${String(blockIndex + 1)}.`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }

      // Check if element is optional (not required)
      if (targetElementInfo.data.required) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Element ${targetElementId} in block ${String(targetElementInfo.block + 1)} is already required in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }
    } else {
      // action.objective === "jumpToBlock"
      const targetBlockId = action.target;
      const blockIds = survey.blocks.map((b) => b.id);
      const endingIds = survey.endings.map((ending) => ending.id);
      const possibleTargets = [...blockIds, ...endingIds];

      if (!possibleTargets.includes(targetBlockId)) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Block ID ${targetBlockId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }

      // Cannot jump to the current block
      if (targetBlockId === currentBlock.id) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Cannot jump to the current block in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
          path: ["blocks", blockIndex, "logic", logicIndex],
        };
      }
    }

    return undefined;
  });

  const jumpToBlockActions = actions.filter((action) => action.objective === "jumpToBlock");
  if (jumpToBlockActions.length > 1) {
    actionIssues.push({
      code: z.ZodIssueCode.custom,
      message: `Conditional Logic: Multiple jump actions are not allowed in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic"],
    });
  }

  const filteredActionIssues = actionIssues.filter((issue): issue is ZodIssue => issue !== undefined);
  return filteredActionIssues;
};

const validateBlockLogicFallback = (
  survey: TSurvey,
  blockIndex: number,
  block: TSurveyBlock
): z.ZodIssue[] | undefined => {
  if (!block.logicFallback) return;

  if (!block.logic?.length && block.logicFallback) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback logic is defined without any logic in block ${String(blockIndex + 1)}`,
        path: ["blocks", blockIndex],
      },
    ];
  } else if (block.id === block.logicFallback) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback logic is defined with the same block in block ${String(blockIndex + 1)}`,
        path: ["blocks", blockIndex],
      },
    ];
  }

  const possibleFallbackIds: string[] = [];

  survey.blocks.forEach((b, idx) => {
    if (idx !== blockIndex) {
      possibleFallbackIds.push(b.id);
    }
  });

  survey.endings.forEach((e) => {
    possibleFallbackIds.push(e.id);
  });

  if (!possibleFallbackIds.includes(block.logicFallback)) {
    return [
      {
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Fallback block ID ${block.logicFallback} does not exist in block ${String(blockIndex + 1)}`,
        path: ["blocks", blockIndex],
      },
    ];
  }
};

const validateBlockLogic = (
  survey: TSurvey,
  blockIndex: number,
  block: TSurveyBlock,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.ZodIssue[] => {
  const logicFallbackIssue = validateBlockLogicFallback(survey, blockIndex, block);

  if (!block.logic || block.logic.length === 0) {
    return logicFallbackIssue ?? [];
  }

  const logicIssues = block.logic.map((logicItem, logicIndex) => {
    return [
      ...validateBlockConditions(survey, blockIndex, logicIndex, logicItem.conditions, allElements),
      ...validateBlockActions(survey, blockIndex, logicIndex, logicItem.actions, block, allElements),
    ];
  });

  return [...logicIssues.flat(), ...(logicFallbackIssue ?? [])];
};

// ZSurvey is a refinement, so to extend it to ZSurveyUpdateInput, we need to transform the innerType and then apply the same refinements.
export const ZSurveyUpdateInput = ZSurvey.innerType()
  .omit({ createdAt: true, updatedAt: true, followUps: true })
  .extend({
    followUps: z
      .array(
        ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true }).and(
          z.object({
            createdAt: z.coerce.date(),
            updatedAt: z.coerce.date(),
          })
        )
      )
      .default([]),
  })
  .and(
    z.object({
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
  )
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => undefined);

// Helper function to make all properties of a Zod object schema optional
const makeSchemaOptional = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{
  [K in keyof T]: z.ZodOptional<T[K]>;
}> => {
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
    projectOverwrites: true,
    languages: true,
    followUps: true,
  })
  .extend({
    name: z.string(), // Keep name required
    questions: ZSurvey.innerType().shape.questions,
    blocks: ZSurvey.innerType().shape.blocks,
    languages: z.array(ZSurveyLanguage).default([]),
    welcomeCard: ZSurveyWelcomeCard.default({
      enabled: false,
    }),
    endings: ZSurveyEndings.default([]),
    type: ZSurveyType.default("link"),
    followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).default([]),
  })
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null)
  .superRefine((data, ctx) => {
    const hasQuestions = data.questions.length > 0;
    const hasBlocks = data.blocks.length > 0;

    if (hasQuestions && hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot provide both questions and blocks. Please provide only one of these fields.",
        path: ["questions"],
      });
    }

    if (!hasQuestions && !hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must provide either questions or blocks. Both cannot be empty.",
        path: ["questions"],
      });
    }
  });

export type TSurvey = z.infer<typeof ZSurvey>;

export const ZSurveyCreateInputWithEnvironmentId = makeSchemaOptional(ZSurvey.innerType())
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    projectOverwrites: true,
    languages: true,
    followUps: true,
  })
  .extend({
    name: z.string(), // Keep name required
    environmentId: z.string(),
    questions: ZSurvey.innerType().shape.questions,
    blocks: ZSurvey.innerType().shape.blocks,
    languages: z.array(ZSurveyLanguage).default([]),
    welcomeCard: ZSurveyWelcomeCard.default({
      enabled: false,
    }),
    endings: ZSurveyEndings.default([]),
    type: ZSurveyType.default("link"),
    followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).default([]),
  })
  .superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null)
  .superRefine((data, ctx) => {
    const hasQuestions = data.questions.length > 0;
    const hasBlocks = data.blocks.length > 0;

    if (hasQuestions && hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cannot provide both questions and blocks. Please provide only one of these fields.",
        path: ["questions"],
      });
    }

    if (!hasQuestions && !hasBlocks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must provide either questions or blocks. Both cannot be empty.",
        path: ["questions"],
      });
    }
  });

export type TSurveyCreateInputWithEnvironmentId = z.infer<typeof ZSurveyCreateInputWithEnvironmentId>;
export interface TSurveyDates {
  createdAt: TSurvey["createdAt"];
  updatedAt: TSurvey["updatedAt"];
}

export type TSurveyCreateInput = z.input<typeof ZSurveyCreateInput>;

export type TSurveyEditorTabs = "elements" | "settings" | "styling" | "followUps";

export const ZSurveyElementSummaryOpenText = z.object({
  type: z.literal(TSurveyElementTypeEnum.OpenText),
  element: ZSurveyOpenTextElement,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryOpenText = z.infer<typeof ZSurveyElementSummaryOpenText>;

export const ZSurveyElementSummaryMultipleChoice = z.object({
  type: z.union([
    z.literal(TSurveyElementTypeEnum.MultipleChoiceMulti),
    z.literal(TSurveyElementTypeEnum.MultipleChoiceSingle),
  ]),
  element: ZSurveyMultipleChoiceElement,
  responseCount: z.number(),
  selectionCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      percentage: z.number(),
      others: z
        .array(
          z.object({
            value: z.string(),
            contact: z
              .object({
                id: ZId,
                userId: z.string().optional(),
              })
              .nullable(),
            contactAttributes: ZContactAttributes.nullable(),
          })
        )
        .optional(),
    })
  ),
});

export type TSurveyElementSummaryMultipleChoice = z.infer<typeof ZSurveyElementSummaryMultipleChoice>;

export const ZSurveyElementSummaryPictureSelection = z.object({
  type: z.literal(TSurveyElementTypeEnum.PictureSelection),
  element: ZSurveyPictureSelectionElement,
  responseCount: z.number(),
  selectionCount: z.number(),
  choices: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
});

export type TSurveyElementSummaryPictureSelection = z.infer<typeof ZSurveyElementSummaryPictureSelection>;

export const ZSurveyElementSummaryRating = z.object({
  type: z.literal(TSurveyElementTypeEnum.Rating),
  element: ZSurveyRatingElement,
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
  csat: z.object({
    satisfiedCount: z.number(),
    satisfiedPercentage: z.number(),
  }),
});

export type TSurveyElementSummaryRating = z.infer<typeof ZSurveyElementSummaryRating>;

export const ZSurveyElementSummaryNps = z.object({
  type: z.literal(TSurveyElementTypeEnum.NPS),
  element: ZSurveyNPSElement,
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
  choices: z.array(
    z.object({
      rating: z.number(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
});

export type TSurveyElementSummaryNps = z.infer<typeof ZSurveyElementSummaryNps>;

export const ZSurveyElementSummaryCta = z.object({
  type: z.literal(TSurveyElementTypeEnum.CTA),
  element: ZSurveyCTAElement,
  impressionCount: z.number(),
  clickCount: z.number(),
  skipCount: z.number(),
  responseCount: z.number(),
  ctr: z.object({
    count: z.number(),
    percentage: z.number(),
  }),
});

export type TSurveyElementSummaryCta = z.infer<typeof ZSurveyElementSummaryCta>;

export const ZSurveyElementSummaryConsent = z.object({
  type: z.literal(TSurveyElementTypeEnum.Consent),
  element: ZSurveyConsentElement,
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

export type TSurveyElementSummaryConsent = z.infer<typeof ZSurveyElementSummaryConsent>;

export const ZSurveyElementSummaryDate = z.object({
  type: z.literal(TSurveyElementTypeEnum.Date),
  element: ZSurveyDateElement,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryDate = z.infer<typeof ZSurveyElementSummaryDate>;

export const ZSurveyElementSummaryFileUpload = z.object({
  type: z.literal(TSurveyElementTypeEnum.FileUpload),
  element: ZSurveyFileUploadElement,
  responseCount: z.number(),
  files: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryFileUpload = z.infer<typeof ZSurveyElementSummaryFileUpload>;

export const ZSurveyElementSummaryCal = z.object({
  type: z.literal(TSurveyElementTypeEnum.Cal),
  element: ZSurveyCalElement,
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

export type TSurveyElementSummaryCal = z.infer<typeof ZSurveyElementSummaryCal>;

export const ZSurveyElementSummaryMatrix = z.object({
  type: z.literal(TSurveyElementTypeEnum.Matrix),
  element: ZSurveyMatrixElement,
  responseCount: z.number(),
  data: z.array(
    z.object({
      rowLabel: z.string(),
      columnPercentages: z.array(
        z.object({
          column: z.string(),
          percentage: z.number(),
        })
      ),
      totalResponsesForRow: z.number(),
    })
  ),
});

export type TSurveyElementSummaryMatrix = z.infer<typeof ZSurveyElementSummaryMatrix>;

export const ZSurveyElementSummaryHiddenFields = z.object({
  type: z.literal("hiddenField"),
  id: z.string(),
  responseCount: z.number(),
  samples: z.array(
    z.object({
      updatedAt: z.date(),
      value: z.string(),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryHiddenFields = z.infer<typeof ZSurveyElementSummaryHiddenFields>;

export const ZSurveyElementSummaryAddress = z.object({
  type: z.literal(TSurveyElementTypeEnum.Address),
  element: ZSurveyAddressElement,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryAddress = z.infer<typeof ZSurveyElementSummaryAddress>;

export const ZSurveyElementSummaryContactInfo = z.object({
  type: z.literal(TSurveyElementTypeEnum.ContactInfo),
  element: ZSurveyContactInfoElement,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      contact: z
        .object({
          id: ZId,
          userId: z.string().optional(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyElementSummaryContactInfo = z.infer<typeof ZSurveyElementSummaryContactInfo>;

export const ZSurveyElementSummaryRanking = z.object({
  type: z.literal(TSurveyElementTypeEnum.Ranking),
  element: ZSurveyRankingElement,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      avgRanking: z.number(),
      others: z
        .array(
          z.object({
            value: z.string(),
            contact: z
              .object({
                id: ZId,
                userId: z.string().optional(),
              })
              .nullable(),
            contactAttributes: ZContactAttributes.nullable(),
          })
        )
        .optional(),
    })
  ),
});
export type TSurveyElementSummaryRanking = z.infer<typeof ZSurveyElementSummaryRanking>;

export const ZSurveyElementSummary = z.union([
  ZSurveyElementSummaryOpenText,
  ZSurveyElementSummaryMultipleChoice,
  ZSurveyElementSummaryPictureSelection,
  ZSurveyElementSummaryRating,
  ZSurveyElementSummaryNps,
  ZSurveyElementSummaryCta,
  ZSurveyElementSummaryConsent,
  ZSurveyElementSummaryDate,
  ZSurveyElementSummaryFileUpload,
  ZSurveyElementSummaryCal,
  ZSurveyElementSummaryMatrix,
  ZSurveyElementSummaryAddress,
  ZSurveyElementSummaryRanking,
  ZSurveyElementSummaryContactInfo,
]);

export type TSurveyElementSummary = z.infer<typeof ZSurveyElementSummary>;

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
    quotasCompleted: z.number(),
    quotasCompletedPercentage: z.number(),
  }),
  dropOff: z.array(
    z.object({
      elementId: z.string().cuid2(),
      elementType: z.nativeEnum(TSurveyElementTypeEnum),
      headline: z.string(),
      ttc: z.number(),
      impressions: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number(),
    })
  ),
  quotas: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      limit: z.number(),
      count: z.number(),
      percentage: z.number(),
    })
  ),
  summary: z.array(z.union([ZSurveyElementSummary, ZSurveyElementSummaryHiddenFields])),
});

export type TSurveySummary = z.infer<typeof ZSurveySummary>;

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
  sortBy: z.enum(["createdAt", "updatedAt", "name", "relevance"]).optional(),
});

export type TSurveyFilterCriteria = z.infer<typeof ZSurveyFilterCriteria>;

export const ZSurveyFilters = z.object({
  name: z.string(),
  createdBy: z.array(z.enum(["you", "others"])),
  status: z.array(ZSurveyStatus),
  type: z.array(ZSurveyType),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "relevance"]),
});

export type TSurveyFilters = z.infer<typeof ZSurveyFilters>;

export const ZFilterOption = z.object({
  label: z.string(),
  value: z.string(),
});

export type TFilterOption = z.infer<typeof ZFilterOption>;

export const ZSortOption = z.object({
  label: z.string(),
  value: z.enum(["createdAt", "updatedAt", "name", "relevance"]),
});

export type TSortOption = z.infer<typeof ZSortOption>;

export const ZSurveyRecallItem = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["element", "hiddenField", "attributeClass", "variable"]),
});

export type TSurveyRecallItem = z.infer<typeof ZSurveyRecallItem>;
