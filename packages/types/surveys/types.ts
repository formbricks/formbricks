/* eslint-disable no-new -- required for error */
import { type ZodIssue, z } from "zod";
import { ZSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { ZInsight } from "@formbricks/database/zod/insights";
import { ZActionClass, ZActionClassNoCodeConfig } from "../action-classes";
import { ZAllowedFileExtension, ZColor, ZId, ZPlacement, getZSafeUrl } from "../common";
import { ZContactAttributes } from "../contact-attribute";
import { ZLanguage } from "../project";
import { ZSegment } from "../segment";
import { ZBaseStyling } from "../styling";
import {
  FORBIDDEN_IDS,
  findLanguageCodesForDuplicateLabels,
  findQuestionsWithCyclicLogic,
  isConditionGroup,
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
  buttonLink: getZSafeUrl("Invalid Button Url in Ending card").optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
});

export type TSurveyEndScreenCard = z.infer<typeof ZSurveyEndScreenCard>;

const validateUrlWithRecall = (url: string): string | null => {
  try {
    if (!url.startsWith("https://")) {
      return "URL must start with https://";
    }

    if (url.includes(" ") && !url.endsWith(" ")) {
      return "URL must not contain spaces";
    }

    new URL(url);

    return null;
  } catch {
    const hostname = url.split("https://")[1];
    if (hostname.includes("#recall:")) {
      return "Recall information cannot be used in the hostname part of the URL";
    }

    return "Invalid Redirect URL";
  }
};

export const ZSurveyRedirectUrlCard = ZSurveyEndingBase.extend({
  type: z.literal("redirectToUrl"),
  url: z
    .string()
    .optional()
    .superRefine((url, ctx) => {
      if (!url) return;

      const error = validateUrlWithRecall(url);
      if (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error,
        });
      }
    }),
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
  Ranking = "ranking",
  ContactInfo = "contactInfo",
  DeployToken = "deployToken",
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

export const ZSurveyQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export const ZSurveyPictureChoice = z.object({
  id: z.string(),
  imageUrl: z.string(),
});

export type TSurveyQuestionChoice = z.infer<typeof ZSurveyQuestionChoice>;

// Logic types
export const ZSurveyLogicConditionsOperator = z.enum([
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
  "isGreaterThan",
  "isLessThan",
  "isGreaterThanOrEqual",
  "isLessThanOrEqual",
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeOneOf",
  "doesNotIncludeAllOf",
  "isClicked",
  "isAccepted",
  "isBefore",
  "isAfter",
  "isBooked",
  "isPartiallySubmitted",
  "isCompletelySubmitted",
  "isSet",
  "isNotSet",
]);

const operatorsWithoutRightOperand = [
  ZSurveyLogicConditionsOperator.Enum.isSubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSkipped,
  ZSurveyLogicConditionsOperator.Enum.isClicked,
  ZSurveyLogicConditionsOperator.Enum.isAccepted,
  ZSurveyLogicConditionsOperator.Enum.isBooked,
  ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSet,
  ZSurveyLogicConditionsOperator.Enum.isNotSet,
] as const;

export const ZDynamicLogicField = z.enum(["question", "variable", "hiddenField"]);
export const ZActionObjective = z.enum(["calculate", "requireAnswer", "jumpToQuestion"]);
export const ZActionTextVariableCalculateOperator = z.enum(["assign", "concat"], {
  message: "Conditional Logic: Invalid operator for a text variable",
});
export const ZActionNumberVariableCalculateOperator = z.enum(
  ["add", "subtract", "multiply", "divide", "assign"],
  { message: "Conditional Logic: Invalid operator for a number variable" }
);

const ZDynamicQuestion = z.object({
  type: z.literal("question"),
  value: z.string().min(1, "Conditional Logic: Question id cannot be empty"),
});

const ZDynamicVariable = z.object({
  type: z.literal("variable"),
  value: z
    .string()
    .cuid2({ message: "Conditional Logic: Variable id must be a valid cuid" })
    .min(1, "Conditional Logic: Variable id cannot be empty"),
});

const ZDynamicHiddenField = z.object({
  type: z.literal("hiddenField"),
  value: z.string().min(1, "Conditional Logic: Hidden field id cannot be empty"),
});

const ZDynamicLogicFieldValue = z.union([ZDynamicQuestion, ZDynamicVariable, ZDynamicHiddenField], {
  message: "Conditional Logic: Invalid dynamic field value",
});

export type TSurveyLogicConditionsOperator = z.infer<typeof ZSurveyLogicConditionsOperator>;
export type TDynamicLogicField = z.infer<typeof ZDynamicLogicField>;
export type TActionObjective = z.infer<typeof ZActionObjective>;
export type TActionTextVariableCalculateOperator = z.infer<typeof ZActionTextVariableCalculateOperator>;
export type TActionNumberVariableCalculateOperator = z.infer<typeof ZActionNumberVariableCalculateOperator>;

// Conditions
const ZLeftOperand = ZDynamicLogicFieldValue;
export type TLeftOperand = z.infer<typeof ZLeftOperand>;

export const ZRightOperandStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const ZRightOperand = z.union([ZRightOperandStatic, ZDynamicLogicFieldValue]);
export type TRightOperand = z.infer<typeof ZRightOperand>;

export const ZSingleCondition = z
  .object({
    id: ZId,
    leftOperand: ZLeftOperand,
    operator: ZSurveyLogicConditionsOperator,
    rightOperand: ZRightOperand.optional(),
  })
  .and(
    z.object({
      connector: z.undefined(),
    })
  )
  .superRefine((val, ctx) => {
    if (
      !operatorsWithoutRightOperand.includes(val.operator as (typeof operatorsWithoutRightOperand)[number])
    ) {
      if (val.rightOperand === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand is required for operator "${val.operator}"`,
          path: ["rightOperand"],
        });
      } else if (val.rightOperand.type === "static" && val.rightOperand.value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand value cannot be empty for operator "${val.operator}"`,
        });
      }
    } else if (val.rightOperand !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: right operand should not be present for operator "${val.operator}"`,
        path: ["rightOperand"],
      });
    }
  });

export type TSingleCondition = z.infer<typeof ZSingleCondition>;

export interface TConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: (TSingleCondition | TConditionGroup)[];
}

const ZConditionGroup: z.ZodType<TConditionGroup> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZSingleCondition, ZConditionGroup])),
  })
);

// Actions
export const ZActionVariableValueType = z.union([z.literal("static"), ZDynamicLogicField]);
export type TActionVariableValueType = z.infer<typeof ZActionVariableValueType>;

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
    ZDynamicLogicFieldValue,
  ]),
});

export const ZActionCalculateNumber = ZActionCalculateBase.extend({
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.number({ message: "Conditional Logic: Value must be a number for number variable" }),
    }),
    ZDynamicLogicFieldValue,
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

const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string().min(1, "Conditional Logic: Target question id cannot be empty"),
});

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

export const ZSurveyReward = z.object({
  chainId: z.number(),
  contractAddress: z.string(),
  amount: z.string(),
  decimals: z.number(),
  name: z.string(),
  logo: z.string(),
  verificationRequired: z.boolean().optional(),
});

export type TSurveyReward = z.infer<typeof ZSurveyReward>;

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
  logicFallback: ZSurveyQuestionId.optional(),
  isDraft: z.boolean().optional(),
});

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextQuestionInputType = z.infer<typeof ZSurveyOpenTextQuestionInputType>;

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

export type TSurveyOpenTextQuestion = z.infer<typeof ZSurveyOpenTextQuestion>;

export const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Consent),
  html: ZI18nString.optional(),
  label: ZI18nString,
  placeholder: z.string().optional(),
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
    .array(ZSurveyQuestionChoice)
    .min(2, { message: "Multiple Choice Question must have at least two choices" }),
  shuffleOption: ZShuffleOption.optional(),
  otherOptionPlaceholder: ZI18nString.optional(),
});

export type TSurveyMultipleChoiceQuestion = z.infer<typeof ZSurveyMultipleChoiceQuestion>;

export const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.NPS),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
});

export type TSurveyNPSQuestion = z.infer<typeof ZSurveyNPSQuestion>;

export const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CTA),
  html: ZI18nString.optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: ZI18nString.optional(),
});

export type TSurveyCTAQuestion = z.infer<typeof ZSurveyCTAQuestion>;

export const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
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
});

export type TSurveyPictureSelectionQuestion = z.infer<typeof ZSurveyPictureSelectionQuestion>;

export const ZSurveyFileUploadQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
});

export type TSurveyFileUploadQuestion = z.infer<typeof ZSurveyFileUploadQuestion>;

export const ZSurveyCalQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Cal),
  calUserName: z.string().min(1, { message: "Cal user name is required" }),
  calHost: z.string().optional(),
});

export type TSurveyCalQuestion = z.infer<typeof ZSurveyCalQuestion>;

export const ZSurveyMatrixQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Matrix),
  rows: z.array(ZI18nString),
  columns: z.array(ZI18nString),
  shuffleOption: ZShuffleOption.optional().default("none"),
});

export type TSurveyMatrixQuestion = z.infer<typeof ZSurveyMatrixQuestion>;

const ZToggleInputConfig = z.object({
  show: z.boolean(),
  required: z.boolean(),
  placeholder: ZI18nString,
});

export type TInputFieldConfig = z.infer<typeof ZToggleInputConfig>;

export const ZSurveyAddressQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Address),
  addressLine1: ZToggleInputConfig,
  addressLine2: ZToggleInputConfig,
  city: ZToggleInputConfig,
  state: ZToggleInputConfig,
  zip: ZToggleInputConfig,
  country: ZToggleInputConfig,
});

export const ZSurveyContactInfoQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.ContactInfo),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
});

export const ZSurveyDeployTokenQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.DeployToken),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
});

export type TSurveyAddressQuestion = z.infer<typeof ZSurveyAddressQuestion>;

export type TSurveyContactInfoQuestion = z.infer<typeof ZSurveyContactInfoQuestion>;

export const ZSurveyRankingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Ranking),
  choices: z
    .array(ZSurveyQuestionChoice)
    .min(2, { message: "Ranking Question must have at least two options" })
    .max(25, { message: "Ranking Question can have at most 25 options" }),
  otherOptionPlaceholder: ZI18nString.optional(),
  shuffleOption: ZShuffleOption.optional(),
});

export type TSurveyRankingQuestion = z.infer<typeof ZSurveyRankingQuestion>;

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
  ZSurveyDeployTokenQuestion,
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
  TSurveyQuestionTypeEnum.Ranking,
  TSurveyQuestionTypeEnum.ContactInfo,
  TSurveyQuestionTypeEnum.DeployToken,
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

export const ZSurveyType = z.enum(["link", "app"]);

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
    followUps: z.array(
      ZSurveyFollowUp.extend({
        deleted: z.boolean().optional(),
      })
    ),
    delay: z.number(),
    autoComplete: z.number().min(1, { message: "Response limit must be greater than 0" }).nullable(),
    runOnDate: z.date().nullable(),
    closeOnDate: z.date().nullable(),
    projectOverwrites: ZSurveyProjectOverwrites.nullable(),
    styling: ZSurveyStyling.nullable(),
    showLanguageSwitch: z.boolean().nullable(),
    surveyClosedMessage: ZSurveyClosedMessage.nullable(),
    segment: ZSegment.nullable(),
    singleUse: ZSurveySingleUse.nullable(),
    isVerifyEmailEnabled: z.boolean(),
    isSingleResponsePerEmailEnabled: z.boolean(),
    isBackButtonHidden: z.boolean(),
    pin: z.string().min(4, { message: "PIN must be a four digit number" }).nullish(),
    resultShareKey: z.string().nullable(),
    displayPercentage: z.number().min(0.01).max(100).nullable(),
    languages: z.array(ZSurveyLanguage),
    public: z.boolean().optional(),
  })
  .superRefine((survey, ctx) => {
    const { questions, languages, welcomeCard, endings, isBackButtonHidden } = survey;

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
        questionIndex === 0 || isBackButtonHidden
          ? initialFieldsToValidate
          : [...initialFieldsToValidate, "backButtonLabel"];

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

    if (survey.followUps.length) {
      survey.followUps
        .filter((followUp) => !followUp.deleted)
        .forEach((followUp, index) => {
          if (followUp.action.properties.to) {
            const validOptions = [
              ...survey.questions
                .filter((q) => {
                  if (q.type === TSurveyQuestionTypeEnum.OpenText) {
                    if (q.inputType === "email") {
                      return true;
                    }
                  }

                  if (q.type === TSurveyQuestionTypeEnum.ContactInfo) {
                    return true;
                  }

                  return false;
                })
                .map((q) => q.id),
              ...(survey.hiddenFields.fieldIds ?? []),
            ];

            if (validOptions.findIndex((option) => option === followUp.action.properties.to) === -1) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `The action in follow up ${String(index + 1)} has an invalid email field`,
                path: ["followUps"],
              });
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
      if (!["isPartiallySubmitted", "isCompletelySubmitted", "isSkipped"].includes(operator)) {
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
  conditions: TConditionGroup
): z.ZodIssue[] => {
  const issues: z.ZodIssue[] = [];

  const validateSingleCondition = (condition: TSingleCondition): void => {
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

  const validateConditionGroup = (group: TConditionGroup): void => {
    group.conditions.forEach((condition) => {
      if (isConditionGroup(condition)) {
        validateConditionGroup(condition);
      } else {
        validateSingleCondition(condition);
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

const validateLogic = (survey: TSurvey, questionIndex: number, logic: TSurveyLogic[]): z.ZodIssue[] => {
  const logicFallbackIssue = validateLogicFallback(survey, questionIndex);

  const logicIssues = logic.map((logicItem, logicIndex) => {
    return [
      ...validateConditions(survey, questionIndex, logicIndex, logicItem.conditions),
      ...validateActions(survey, questionIndex, logicIndex, logicItem.actions),
    ];
  });

  return [...logicIssues.flat(), ...(logicFallbackIssue ? logicFallbackIssue : [])];
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
    projectOverwrites: true,
    languages: true,
    followUps: true,
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
    followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).default([]),
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

export type TSurveyEditorTabs = "questions" | "settings" | "styling" | "followUps" | "rewards";

export const ZSurveyQuestionSummaryOpenText = z.object({
  type: z.literal("openText"),
  question: ZSurveyOpenTextQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
  insights: z.array(
    ZInsight.extend({
      _count: z.object({
        documentInsights: z.number(),
      }),
    })
  ),
  insightsEnabled: z.boolean().optional(),
});

export type TSurveyQuestionSummaryOpenText = z.infer<typeof ZSurveyQuestionSummaryOpenText>;

export const ZSurveyQuestionSummaryMultipleChoice = z.object({
  type: z.union([z.literal("multipleChoiceMulti"), z.literal("multipleChoiceSingle")]),
  question: ZSurveyMultipleChoiceQuestion,
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
                userId: z.string(),
              })
              .nullable(),
            contactAttributes: ZContactAttributes.nullable(),
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
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
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
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
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

export type TSurveyQuestionSummaryMatrix = z.infer<typeof ZSurveyQuestionSummaryMatrix>;

export const ZSurveyQuestionSummaryHiddenFields = z.object({
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
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
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
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryAddress = z.infer<typeof ZSurveyQuestionSummaryAddress>;

export const ZSurveyQuestionSummaryContactInfo = z.object({
  type: z.literal("contactInfo"),
  question: ZSurveyContactInfoQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryContactInfo = z.infer<typeof ZSurveyQuestionSummaryContactInfo>;

export const ZSurveyQuestionSummaryDeployToken = z.object({
  type: z.literal("contactInfo"),
  question: ZSurveyContactInfoQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      contact: z
        .object({
          id: ZId,
          userId: z.string(),
        })
        .nullable(),
      contactAttributes: ZContactAttributes.nullable(),
    })
  ),
});

export type TSurveyQuestionSummaryDeployToken = z.infer<typeof ZSurveyQuestionSummaryDeployToken>;

export const ZSurveyQuestionSummaryRanking = z.object({
  type: z.literal("ranking"),
  question: ZSurveyRankingQuestion,
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
                userId: z.string(),
              })
              .nullable(),
            contactAttributes: ZContactAttributes.nullable(),
          })
        )
        .optional(),
    })
  ),
});
export type TSurveyQuestionSummaryRanking = z.infer<typeof ZSurveyQuestionSummaryRanking>;

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
  ZSurveyQuestionSummaryRanking,
  ZSurveyQuestionSummaryContactInfo,
  ZSurveyQuestionSummaryDeployToken,
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
      questionType: ZSurveyQuestionType,
      headline: z.string(),
      ttc: z.number(),
      impressions: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number(),
    })
  ),
  summary: z.array(z.union([ZSurveyQuestionSummary, ZSurveyQuestionSummaryHiddenFields])),
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
  type: z.enum(["question", "hiddenField", "attributeClass", "variable"]),
});

export type TSurveyRecallItem = z.infer<typeof ZSurveyRecallItem>;
