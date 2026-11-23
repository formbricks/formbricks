/* eslint-disable typescript/no-deprecated -- this module defines the deprecated v1 question types and
 * builds them, and the survey schema that still accepts them, from one another. */
import { z } from "zod";
import { ZActionClass, ZActionClassNoCodeConfig } from "../action-classes";
import {
  ZColor,
  ZEndingCardButtonLink,
  ZEndingCardUrl,
  ZId,
  ZOverlay,
  ZPlacement,
  ZStorageUrl,
  getZSafeUrl,
} from "../common";
import { ZContactAttributes } from "../contact-attribute";
import { ZCustomCssStored } from "../custom-css";
import { type TEmbeddedDataType, ZLinkedEmbeddedField } from "../embedded-data";
import { linkedToDesiredEmbeddedFields, toLegacyEmbeddedFields } from "../embedded-data-mapping";
import { RESERVED_FIELD_CATALOG } from "../embedded-data-resolver";
import { type TI18nString, ZI18nString } from "../i18n";
import { ZOverlayColor, ZOverlayOpacity } from "../overlay";
import { isLegacyIdCharset, isLegacyVariableName, isObjectPrototypeName } from "../safe-identifier";
import { ZSegment } from "../segment";
import { ZShowConditions } from "../show-conditions";
import { ZAllowedFileExtension } from "../storage";
import { ZBaseStyling } from "../styling";
import { ZLanguage } from "../workspace";
import {
  type TSurveyBlock,
  type TSurveyBlockLogicAction,
  ZActionMarkLowQuality,
  ZSurveyBlockLogic,
  ZSurveyBlocks,
} from "./blocks";
import { findBlocksWithCyclicLogic } from "./blocks-validation";
import {
  BOOLEAN_ASSIGN_MESSAGE,
  BOOLEAN_VALUE_TARGET_MESSAGE,
  isStaticBooleanValue,
  isValidBooleanAssign,
} from "./boolean-assign";
import { validateSurveyCodes } from "./codes";
import { getCopiedOptionsIssues } from "./copied-options";
import {
  type TSurveyElement,
  TSurveyElementTypeEnum,
  ZSurveyAddressElement,
  ZSurveyCTAElement,
  ZSurveyCalElement,
  ZSurveyCesElement,
  ZSurveyConsentElement,
  ZSurveyContactInfoElement,
  ZSurveyCsatElement,
  ZSurveyDateElement,
  ZSurveyFileUploadElement,
  ZSurveyMatrixElement,
  ZSurveyMultipleChoiceElement,
  ZSurveyNPSElement,
  ZSurveyOpenTextElement,
  ZSurveyPictureSelectionElement,
  ZSurveyRankingElement,
  ZSurveyRatingElement,
  ZSurveySignatureElement,
} from "./elements";
import { validateElementLabels } from "./elements-validation";
import { type TExpressionTypeContext, getSetValueExpressionIssues } from "./expression-types";
import { ZSurveyFollowUp } from "./follow-up";
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
import { type TFindMatrix, findUnknownMatrixIds, isMatrixRowCondition } from "./matrix-conditions";
import { OPTION_LIST_NAMES } from "./not-shown";
import { getOptionLists } from "./show-if";
import { validateStartLogic } from "./start-logic-validation";
import {
  FORBIDDEN_IDS,
  findLanguageCodesForDuplicateLabels,
  findQuestionsWithCyclicLogic,
  isConditionGroup,
  validateCardFieldsForAllLanguages,
  validateQuestionLabels,
} from "./validation";

const ZSurveyEndingBase = z.object({
  id: z.cuid2(),
});

export const ZSurveyEndScreenCard = ZSurveyEndingBase.extend({
  type: z.literal("endScreen"),
  headline: ZI18nString.optional(),
  subheader: ZI18nString.optional(),
  buttonLabel: ZI18nString.optional(),
  buttonLink: ZEndingCardButtonLink.optional(),
  imageUrl: ZStorageUrl.optional(),
  imageAltText: ZI18nString.optional(),
  videoUrl: ZStorageUrl.optional(),
  // Absent means "show it": the checkmark predates this field, so every survey written before it has to
  // keep rendering the icon.
  hideDefaultIcon: z.boolean().optional(),
});

export type TSurveyEndScreenCard = z.infer<typeof ZSurveyEndScreenCard>;

export const ZSurveyRedirectUrlCard = ZSurveyEndingBase.extend({
  type: z.literal("redirectToUrl"),
  url: ZEndingCardUrl.optional(),
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
  CSAT = "csat",
  CES = "ces",
  Signature = "signature",
}

/**
 * @deprecated Use ZSurveyElementId / TSurveyElementId instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyQuestionId = z.string().superRefine((id, ctx) => {
  if (FORBIDDEN_IDS.includes(id) || isObjectPrototypeName(id)) {
    ctx.addIssue({
      code: "custom",
      message: `Question id is not allowed`,
    });
  }

  if (id.includes(" ")) {
    ctx.addIssue({
      code: "custom",
      message: "Question id not allowed, avoid using spaces.",
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    ctx.addIssue({
      code: "custom",
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
    fileUrl: ZStorageUrl.optional(),
    buttonLabel: ZI18nString.optional(),
    timeToFinish: z.boolean().prefault(true),
    showResponseCount: z.boolean().prefault(false),
    videoUrl: ZStorageUrl.optional(),
  })
  .refine((schema) => !(schema.enabled && !schema.headline), {
    error: "Welcome card must have a headline",
  });

export type TSurveyWelcomeCard = z.infer<typeof ZSurveyWelcomeCard>;

export const ZSurveyHiddenFields = z.object({
  enabled: z.boolean(),
  fieldIds: z.optional(
    z.array(
      z.string().superRefine((field, ctx) => {
        if (FORBIDDEN_IDS.includes(field) || isObjectPrototypeName(field)) {
          ctx.addIssue({
            code: "custom",
            message: `Hidden field id is not allowed`,
          });
        }

        if (field.includes(" ")) {
          ctx.addIssue({
            code: "custom",
            message: "Hidden field id not allowed, avoid using spaces.",
          });
        }

        // Lenient on purpose: this schema also parses surveys loaded from the database, which
        // still hold hidden field names created before `isSafeIdentifier`. New names are gated
        // strictly by `validateId` in the editor.
        if (!isLegacyIdCharset(field)) {
          ctx.addIssue({
            code: "custom",
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
      id: z.cuid2(),
      name: z.string(),
      type: z.literal("number"),
      value: z.number().prefault(0),
    }),
    z.object({
      id: z.cuid2(),
      name: z.string(),
      type: z.literal("text"),
      value: z.string().prefault(""),
    }),
  ])
  .superRefine((data, ctx) => {
    // A variable's value is stored under its id, and `z.cuid2()` alone accepts `constructor`.
    if (isObjectPrototypeName(data.id)) {
      ctx.addIssue({ code: "custom", message: "Variable id is not allowed", path: ["id"] });
    }

    // Lenient on purpose: this schema also parses surveys loaded from the database, which still
    // hold variable names created before `isSafeIdentifier` (e.g. `_legacy`). New names are gated
    // strictly by the variable editor.
    if (!isLegacyVariableName(data.name)) {
      ctx.addIssue({
        code: "custom",
        message: "Variable name can only contain lowercase letters, numbers, and underscores",
        path: ["variables"],
      });
    }
  });
export const ZSurveyVariables = z.array(ZSurveyVariable);

/**
 * The variables array as a **stored** survey must satisfy it: ids unique, names unique.
 *
 * Separate from `ZSurveyVariables`, which is deliberately unrefined because partial payloads and
 * derived fragments parse against it. Exported so the write path can check the same rule `ZSurvey`
 * will apply on the next read — a guard that parsed the bare array would accept a survey it could
 * never load again, which is the one failure it exists to prevent.
 */
export const ZStoredSurveyVariables = ZSurveyVariables.superRefine((variables, ctx) => {
  const variableIds = variables.map((v) => v.id);
  if (new Set(variableIds).size !== variableIds.length) {
    ctx.addIssue({ code: "custom", message: "Variable IDs must be unique", path: ["variables"] });
  }

  const variableNames = variables.map((v) => v.name);
  if (new Set(variableNames).size !== variableNames.length) {
    ctx.addIssue({ code: "custom", message: "Variable names must be unique", path: ["variables"] });
  }
});

export type TSurveyVariable = z.infer<typeof ZSurveyVariable>;
export type TSurveyVariables = z.infer<typeof ZSurveyVariables>;

export const ZSurveySlug = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens");

export type TSurveySlug = z.infer<typeof ZSurveySlug>;

export const ZSurveyWorkspaceOverwrites = z.object({
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  placement: ZPlacement.nullish(),
  clickOutsideClose: z.boolean().nullish(),
  overlay: ZOverlay.nullish(),
  // Only read when `overlay` is set here too (see resolveOverlayAppearance).
  overlayColor: ZOverlayColor.nullish(),
  overlayOpacity: ZOverlayOpacity.nullish(),
});

export type TSurveyWorkspaceOverwrites = z.infer<typeof ZSurveyWorkspaceOverwrites>;

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
    threshold: z.number().min(0.1).max(0.9).multipleOf(0.1),
  })
  .nullable();

export type TSurveyRecaptcha = z.infer<typeof ZSurveyRecaptcha>;

export const ZSurveyMetadata = z
  .object({
    title: ZI18nString.optional(),
    description: ZI18nString.optional(),
    ogImage: ZStorageUrl.optional(),
  })
  .catchall(z.unknown());

export type TSurveyMetadata = z.infer<typeof ZSurveyMetadata>;

export const ZSurveyQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString,
  code: z.string().optional(),
});

export const ZSurveyPictureChoice = z.object({
  id: z.string(),
  code: z.string().optional(),
  imageUrl: ZStorageUrl,
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
        .string({
          error: "Conditional Logic: Value must be a string for text variable",
        })
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
      value: z.number({
        error: "Conditional Logic: Value must be a number for number variable",
      }),
    }),
    ZDynamicLogicFieldValueDeprecated, // Accept both "question" and "element" for backward compatibility
  ]),
}).superRefine((val, ctx) => {
  if (val.operator === "divide" && val.value.type === "static" && val.value.value === 0) {
    ctx.addIssue({
      code: "custom",
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

// `markLowQuality` (ENG-6933) is carried as it is, so the v1 questions view round-trips a block rule using it.
export const ZSurveyLogicAction = z.union([
  ZActionCalculate,
  ZActionRequireAnswer,
  ZActionJumpToQuestion,
  ZActionMarkLowQuality,
]);

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
  imageUrl: ZStorageUrl.optional(),
  videoUrl: ZStorageUrl.optional(),
  required: z.boolean(),
  buttonLabel: ZI18nString.optional(),
  backButtonLabel: ZI18nString.optional(),
  scale: z.enum(["number", "smiley", "star"]).optional(),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]).optional(),
  logic: z.array(ZSurveyLogicDeprecated).optional(),
  logicFallback: ZSurveyQuestionId.optional(),
  isDraft: z.boolean().optional(),
});

// Legacy twin of `ZSurveyQuestionElementBase`: every question but CTA can carry a code, so the v1
// API round-trips it (ENG-6778).
export const ZSurveyCodedQuestionBase = ZSurveyQuestionBase.extend({
  code: z.string().optional(),
});

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextQuestionInputType = z.infer<typeof ZSurveyOpenTextQuestionInputType>;

/**
 * @deprecated Use ZSurveyOpenTextElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyOpenTextQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.OpenText),
  placeholder: ZI18nString.optional(),
  longAnswer: z.boolean().optional(),
  inputType: ZSurveyOpenTextQuestionInputType.prefault("text"),
  insightsEnabled: z.boolean().prefault(false).optional(),
  charLimit: z
    .object({
      enabled: z.boolean().prefault(false).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .prefault({ enabled: false }),
}).superRefine((data, ctx) => {
  if (data.charLimit.enabled && data.charLimit.min === undefined && data.charLimit.max === undefined) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the values for either minimum or maximum field",
    });
  }

  if (
    (data.charLimit.min !== undefined && data.charLimit.min < 0) ||
    (data.charLimit.max !== undefined && data.charLimit.max < 0)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "The character limit values should be positive",
    });
  }

  if (
    data.charLimit.min !== undefined &&
    data.charLimit.max !== undefined &&
    data.charLimit.min > data.charLimit.max
  ) {
    ctx.addIssue({
      code: "custom",
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
export const ZSurveyConsentQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Consent),
  label: ZI18nString,
});

/**
 * @deprecated Use TSurveyConsentElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyConsentQuestion = z.infer<typeof ZSurveyConsentQuestion>;

export const ZShuffleOption = z.enum([
  "none",
  "all",
  "exceptLast",
  "reverseOrderOccasionally",
  "reverseOrderExceptLast",
]);

export type TShuffleOption = z.infer<typeof ZShuffleOption>;

/**
 * @deprecated Use ZSurveyMultipleChoiceElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyMultipleChoiceQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.union([
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
    z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  ]),
  choices: z.array(ZSurveyQuestionChoice).min(2, {
    error: "Multiple Choice Question must have at least two choices",
  }),
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
export const ZSurveyNPSQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.NPS),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().prefault(false),
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
export const ZSurveyRatingQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(6), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().prefault(false),
});

/**
 * @deprecated Use ZSurveyDateElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyDateQuestion = ZSurveyCodedQuestionBase.extend({
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
export const ZSurveyPictureSelectionQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  allowMulti: z.boolean().prefault(false),
  choices: z.array(ZSurveyPictureChoice).min(2, {
    error: "Picture Selection question must have atleast 2 choices",
  }),
});

/**
 * @deprecated Use TSurveyPictureSelectionElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyPictureSelectionQuestion = z.infer<typeof ZSurveyPictureSelectionQuestion>;

/**
 * @deprecated Use ZSurveyFileUploadElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyFileUploadQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
});

/**
 * @deprecated Use TSurveyFileUploadElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyFileUploadQuestion = z.infer<typeof ZSurveyFileUploadQuestion>;

/** The v1 API shape of a Signature element; use ZSurveySignatureElement in new code. */
export const ZSurveySignatureQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Signature), // NOSONAR the v1 compatibility shape has to name the legacy enum member
  allowTypedSignature: z.boolean().prefault(true),
});

/** The v1 API shape of a Signature element; use TSurveySignatureElement in new code. */
export type TSurveySignatureQuestion = z.infer<typeof ZSurveySignatureQuestion>;

/**
 * @deprecated Use ZSurveyCalElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyCalQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Cal),
  calUserName: z.string().min(1, {
    error: "Cal user name is required",
  }),
  calHost: z.string().optional(),
});

/**
 * @deprecated Use TSurveyCalElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyCalQuestion = z.infer<typeof ZSurveyCalQuestion>;

export const ZSurveyMatrixQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString,
  code: z.string().optional(),
});

export type TSurveyMatrixQuestionChoice = z.infer<typeof ZSurveyMatrixQuestionChoice>;

/**
 * @deprecated Use ZSurveyMatrixElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyMatrixQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Matrix),
  rows: z.array(ZSurveyMatrixQuestionChoice),
  columns: z.array(ZSurveyMatrixQuestionChoice),
  shuffleOption: ZShuffleOption.prefault("none"),
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
export const ZSurveyAddressQuestion = ZSurveyCodedQuestionBase.extend({
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
export const ZSurveyContactInfoQuestion = ZSurveyCodedQuestionBase.extend({
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
export const ZSurveyRankingQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.Ranking),
  choices: z
    .array(ZSurveyQuestionChoice)
    .min(2, {
      error: "Ranking Question must have at least two options",
    })
    .max(25, {
      error: "Ranking Question can have at most 25 options",
    }),
  otherOptionPlaceholder: ZI18nString.optional(),
  shuffleOption: ZShuffleOption.optional(),
});

/**
 * @deprecated Use TSurveyRankingElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyRankingQuestion = z.infer<typeof ZSurveyRankingQuestion>;

/**
 * @deprecated Use ZSurveyCsatElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyCsatQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CSAT),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.literal(5),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().prefault(false),
});

/**
 * @deprecated Use TSurveyCsatElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyCsatQuestion = z.infer<typeof ZSurveyCsatQuestion>;

/**
 * @deprecated Use ZSurveyCesElement instead. Kept for v1 API backward compatibility only.
 */
export const ZSurveyCesQuestion = ZSurveyCodedQuestionBase.extend({
  type: z.literal(TSurveyQuestionTypeEnum.CES),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(7)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().prefault(false),
});

/**
 * @deprecated Use TSurveyCesElement instead. Kept for v1 API backward compatibility only.
 */
export type TSurveyCesQuestion = z.infer<typeof ZSurveyCesQuestion>;

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
  ZSurveyCsatQuestion,
  ZSurveyCesQuestion,
  ZSurveySignatureQuestion,
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
  TSurveyQuestionTypeEnum.CSAT,
  TSurveyQuestionTypeEnum.CES,
  TSurveyQuestionTypeEnum.Signature, // NOSONAR the v1 compatibility list has to name the legacy enum member
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

/** Replaces "default" in `languageCodes` with the code of the survey's default language, if it has one. */
const resolveDefaultLanguageCode = (languageCodes: string[], languages: TSurveyLanguage[]): string[] => {
  const defaultLanguageCode = languages.find((lang) => lang.default)?.language.code ?? "default";
  return languageCodes.map((languageCode) =>
    languageCode === "default" ? defaultLanguageCode : languageCode
  );
};

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

// ENG-3282: who may read a survey. `workspace` is everyone with workspace access; `restricted` is the
// owner and the organization's owners and managers only.
export const ZSurveyVisibility = z.enum(["restricted", "workspace"]);

export type TSurveyVisibility = z.infer<typeof ZSurveyVisibility>;

export const ZSurveyInlineTriggers = z.object({
  codeConfig: z.object({ identifier: z.string() }).optional(),
  noCodeConfig: ZActionClassNoCodeConfig.optional(),
});

export type TSurveyInlineTriggers = z.infer<typeof ZSurveyInlineTriggers>;

/**
 * Rules before the first question a survey may hold (ENG-6932). A screener has a handful; a ceiling,
 * not a target. New in 6.2, so no stored survey exceeds it. The v3 API advertises the same number.
 */
export const MAX_START_LOGIC_RULES = 100;

export const ZSurveyBase = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  type: ZSurveyType,
  workspaceId: z.cuid2(),
  createdBy: z.string().nullable(),
  // ENG-3282 authorization facts. Server-owned: omitted from every create/update input below, set only
  // by the creation-facts resolver and the visibility endpoint. `visibility` is the stored flag, not
  // the effective one — see `getEffectiveVisibility`.
  visibility: ZSurveyVisibility,
  ownerId: z.string().nullable(),
  visibilityVersion: z.number().int(),
  visibilityProjectedVersion: z.number().int(),
  visibilityChangedAt: z.date().nullable(),
  visibilityChangedById: z.string().nullable(),
  status: ZSurveyStatus,
  displayOption: ZSurveyDisplayOption,
  autoClose: z.number().nullable(),
  // App surveys close 3 seconds after the ending card unless this is on, in which case the ending card
  // stays until the respondent closes it (WCAG 2.2.1). Not the inactivity `autoClose` above. Optional so
  // surveys built in memory (templates, previews) read as off, matching the column default.
  keepEndingCardOpen: z.boolean().optional(),
  triggers: z.array(z.object({ actionClass: ZActionClass })),
  // This variable should be called `cooldownPeriod`, not `recontactDays`. It is related to the
  // Survey Cooldown Period feature (across surveys) and not the Recontact Options (per survey).
  recontactDays: z.number().nullable(),
  displayLimit: z.number().nullable(),
  welcomeCard: ZSurveyWelcomeCard,
  // TODO: Remove this once blocks are the single source of truth
  questions: ZSurveyQuestions.prefault([]).superRefine((questions, ctx) => {
    const questionIds = questions.map((q) => q.id);
    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Question IDs must be unique",
        path: [questionIds.findIndex((id, index) => questionIds.indexOf(id) !== index), "id"],
      });
    }
  }),
  blocks: ZSurveyBlocks.prefault([]).superRefine((blocks, ctx) => {
    const blockIds = blocks.map((b) => b.id);
    const uniqueBlockIds = new Set(blockIds);
    if (uniqueBlockIds.size !== blockIds.length) {
      ctx.addIssue({
        code: "custom",
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
        code: "custom",
        message: "Ending IDs must be unique",
        path: [endingIds.findIndex((id, index) => endingIds.indexOf(id) !== index), "id"],
      });
    }
  }),
  hiddenFields: ZSurveyHiddenFields,
  /**
   * The survey's Embedded Data definitions, joined from `EmbeddedData` / `SurveyEmbeddedData` and
   * inlined when the survey is loaded (ENG-1837). This is the **read** source of truth for every
   * reader — reach it through `getSurveyEmbeddedFields`, never directly. `variables` / `hiddenFields`
   * above and below are a read-only projection derived from it at load (ENG-2404), kept for the
   * payloads deployed SDK bundles and API consumers still read.
   *
   * Since ENG-3228 it is also **accepted input** on `updateSurvey` and `createSurvey`: one shape for
   * read and write, so the editor sends back the pairs it was loaded with, carrying the `dataType`,
   * `defaultValue`, `locked` and shared-library link the legacy shape has no word for. Present in
   * a payload, it is the complete desired set for both sources and `variables` / `hiddenFields` are
   * ignored; absent, those two legacy keys run the write exactly as before.
   *
   * Still optional — every survey literal, fixture and create payload in the codebase predates it —
   * and still never spread into Prisma: `Survey` owns relations named `embeddedData` /
   * `embeddedDataLinks`, so each write seam destructures this key out and lets
   * `reconcileEmbeddedData` do the writing.
   */
  embeddedFields: z.array(ZLinkedEmbeddedField).optional(),
  variables: ZStoredSurveyVariables,
  followUps: z.array(
    ZSurveyFollowUp.extend({
      deleted: z.boolean().optional(),
    })
  ),
  delay: z.number(),
  publishOn: z.coerce
    .date()
    .nullish()
    .transform((value) => value ?? null),
  closeOn: z.coerce
    .date()
    .nullish()
    .transform((value) => value ?? null),
  // Soft-delete marker (ENG-1042). Optional (no transform) so it stays non-required on the inferred
  // TSurvey type — existing survey literals/payloads that omit it keep compiling and validating.
  // Reads populate it from the DB so archived state is available to the editor/summary surfaces.
  archivedAt: z.coerce.date().nullish(),
  autoComplete: z
    .number()
    .min(1, {
      error: "Response limit must be greater than 0",
    })
    .nullable(),
  workspaceOverwrites: ZSurveyWorkspaceOverwrites.nullable(),
  styling: ZSurveyStyling.nullable(),
  showLanguageSwitch: z.boolean().nullable(),
  // Optional so survey literals and API payloads that predate the setting keep validating; null and
  // undefined both read as "off".
  autoSelectLanguage: z.boolean().nullish(),
  surveyClosedMessage: ZSurveyClosedMessage.nullable(),
  segment: ZSegment.nullable(),
  singleUse: ZSurveySingleUse.nullable(),
  isVerifyEmailEnabled: z.boolean(),
  recaptcha: ZSurveyRecaptcha.nullable(),
  isBackButtonHidden: z.boolean(),
  isAutoProgressingEnabled: z.boolean().prefault(false),
  isCaptureIpEnabled: z.boolean(),
  /**
   * "Anonymize responses". Suppresses the privacy-sensitive reserved fields **at ingest**, so the
   * response is stored without them rather than stored and filtered on read.
   *
   * A field of its own and deliberately not `!isCaptureIpEnabled`: that flag also defaults to false,
   * so reading anonymize off it would retroactively anonymize every survey that already exists.
   */
  isAnonymizeResponsesEnabled: z.boolean(),
  pin: z
    .string()
    .length(4, {
      error: "PIN must be a four digit number",
    })
    .nullish(),
  displayPercentage: z.number().min(0.01).max(100).nullable(),
  languages: z.array(ZSurveyLanguage),
  metadata: ZSurveyMetadata,
  slug: ZSurveySlug.nullable(),
  customHeadScripts: z.string().nullish(),
  customHeadScriptsMode: z.enum(["add", "replace"]).nullish(),
  /**
   * Survey custom CSS as stored (ENG-2949): source plus trusted compiled output. Nullish so survey
   * objects built without it still type-check. Only the shared custom CSS save service writes it, and
   * it reads nothing but `source` from a payload — `compiled` and `processorVersion` sent by a caller
   * are ignored and recomputed.
   */
  customCss: ZCustomCssStored.nullish(),
  /**
   * App surveys: conditions checked in the browser when a trigger fires (ENG-3873). `null` means no
   * conditions; an empty group is stored as `null` too. Nullish so survey objects built without it
   * still type-check.
   */
  showConditions: ZShowConditions.nullish(),
  /**
   * Rules before the first question (ENG-6932, json-shapes.md section 4): the block-rule format, run
   * by the survey as soon as it loads, before the welcome card and on start-at links. They may jump
   * to a block, screen out by jumping to an ending, and set a value; `surveyRefinement` refuses the
   * rest. Nullish: `null` (the column default) and a missing key both mean none.
   */
  startLogic: z.array(ZSurveyBlockLogic).max(MAX_START_LOGIC_RULES).nullish(),
});

/**
 * The survey this refinement resolves logic operands and follow-up recipients against.
 *
 * Identical to the input except for `variables` / `hiddenFields`, which are re-derived when the
 * payload declares its Embedded Data as rows — the same derivation the read seam runs over the
 * stored rows (`toLegacyEmbeddedFields`), so what this validates against is what the survey will
 * read back as once the write lands rather than what the legacy keys happen to say on the way in.
 *
 * That distinction only exists because of the editor (ENG-2628): its working copy is rows-native,
 * so the two legacy keys it forwards are whatever it was loaded with at mount, and a variable or
 * hidden field added since then lives only in `embeddedFields`. Without this, using a freshly added
 * field in logic — or as a follow-up recipient — would fail `ZSurvey` on publish, both in the
 * editor's own pre-flight and again as the server action's input schema.
 *
 * A payload with no `embeddedFields` is untouched. The legacy writes (the v1 management PUT, and
 * `updateSurvey` given only `variables` / `hiddenFields`) validate with the rows the write will leave
 * the survey with (`getLegacyWriteEmbeddedFields` in apps/web), which are the legacy keys plus the
 * stored fields those keys can't say, such as a computed date (ENG-6935).
 */
const withDerivedLegacyColumns = <T extends z.infer<typeof ZSurveyBase>>(survey: T): T => {
  if (survey.embeddedFields === undefined) return survey;

  const derived = toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(survey.embeddedFields));
  return { ...survey, variables: derived.variables, hiddenFields: derived.hiddenFields };
};

type TSurveyInput = z.infer<typeof ZSurveyBase>;
type TElementOfType<T extends TSurveyElementTypeEnum> = Extract<TSurveyElement, { type: T }>;
/** A contact-info or address sub-field, named for its issue messages. */
interface TLabelledSubfield {
  show: boolean;
  placeholder: TI18nString;
  label: string;
}

/** What a refinement can add: a full issue, or the custom-issue shorthand the checks below build. */
type TRefinementIssue = Exclude<Parameters<z.RefinementCtx["addIssue"]>[0], string>;

const DEFAULT_LANGUAGE_CODE = "default";
const CAL_HOSTNAME_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-)){1,}$/i;

/** Adds the issue a label validator returned, if it returned one. */
const addIssueIfAny = (ctx: z.RefinementCtx, issue: TRefinementIssue | null | false): void => {
  if (issue) ctx.addIssue(issue);
};

/** Whether an optional translated label has a non-blank default text. */
const hasDefaultText = (label: TI18nString | null | undefined): label is TI18nString =>
  typeof label?.[DEFAULT_LANGUAGE_CODE] !== "undefined" && label[DEFAULT_LANGUAGE_CODE].trim() !== "";

/**
 * The issue for a set of labels that repeat in some language, or null when none repeat. The languages
 * are listed in `params` unless only the default language repeats; `describe` is the message without
 * that suffix.
 */
const duplicateLabelsIssue = (
  labels: TI18nString[],
  languages: TSurveyLanguage[],
  describe: string,
  path: (string | number)[]
): TRefinementIssue | null => {
  const duplicateLanguageCodes = findLanguageCodesForDuplicateLabels(labels, languages);
  if (duplicateLanguageCodes.length === 0) return null;

  const invalidLanguageCodes = resolveDefaultLanguageCode(duplicateLanguageCodes, languages);

  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

  return {
    code: "custom",
    message: `${describe} ${isDefaultOnly ? "" : "for the following languages:"}`,
    path,
    params: isDefaultOnly ? undefined : { invalidLanguageCodes },
  };
};

/**
 * The issue for a button or redirect URL: required, and valid against `schema`. `label` starts each
 * message ("Ending card 2", "Question 3").
 */
const urlFieldIssue = (
  url: string | undefined,
  schema: z.ZodType,
  label: string,
  emptyMessage: string,
  path: (string | number)[]
): TRefinementIssue | null => {
  if (!url || url.trim() === "") {
    return { code: "custom", message: `${label}: ${emptyMessage}`, path };
  }
  const parsedUrl = schema.safeParse(url);
  if (parsedUrl.success) return null;
  return { code: "custom", message: `${label}: ${parsedUrl.error.issues[0].message}`, path };
};

// --- Embedded Data, model and codes ---

/**
 * `ZSurveyBase` already ran this over the *incoming* `variables`, which the derivation in
 * `surveyRefinement` has just replaced — so on a rows-native payload nothing has checked what the
 * survey will actually read back as. Two computed fields can derive one legacy name (a local `score`
 * alongside a library field keyed `score`), and that survey would parse here and then fail its next
 * save. `updateSurvey` refuses it before it writes; running the same schema here is what stops the
 * editor's pre-flight and the server action's input schema disagreeing with the write path about the
 * same payload.
 */
const validateDerivedVariables = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  if (survey.embeddedFields === undefined) return;
  const derived = ZStoredSurveyVariables.safeParse(survey.variables);
  if (derived.success) return;
  for (const issue of derived.error.issues) {
    ctx.addIssue({ code: "custom", message: issue.message, path: ["embeddedFields"] });
  }
};

/** Validate: must have questions OR blocks with elements, not both. */
const validateSurveyModel = (hasQuestions: boolean, hasBlocks: boolean, ctx: z.RefinementCtx): void => {
  if (!hasQuestions && !hasBlocks) {
    ctx.addIssue({
      code: "custom",
      message: "Survey must have either questions or blocks with elements",
      path: ["questions"],
    });
  }

  if (hasQuestions && hasBlocks) {
    ctx.addIssue({
      code: "custom",
      message: "Survey cannot have both questions and blocks. Use one model.",
      path: ["blocks"],
    });
  }
};

/**
 * Question codes and answer codes (ENG-6778). Embedded Data names are read from the derived legacy
 * columns, which hold both the hidden fields and the variables whichever carrier the payload used.
 */
const validateSurveyCodeNames = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  // Typed as optional on purpose: the create-input schema reaches this refinement with both absent.
  const declared: { hiddenFields?: { fieldIds?: string[] }; variables?: { name: string }[] } = survey;
  const embeddedDataNames = [
    ...(declared.hiddenFields?.fieldIds ?? []),
    ...(declared.variables ?? []).map((variable) => variable.name),
  ];
  for (const issue of validateSurveyCodes({ blocks: survey.blocks, embeddedDataNames })) {
    ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
  }
};

// --- Welcome card ---

const validateWelcomeCard = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  const { welcomeCard, languages } = survey;
  if (!welcomeCard.enabled) return;

  if (welcomeCard.headline) {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("cardHeadline", welcomeCard.headline, languages, "welcome")
    );
  }

  if (welcomeCard.subheader && welcomeCard.subheader.default.trim() !== "") {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("welcomeCardSubheader", welcomeCard.subheader, languages, "welcome")
    );
  }

  if (welcomeCard.buttonLabel && welcomeCard.buttonLabel.default.trim() !== "") {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("buttonLabel", welcomeCard.buttonLabel, languages, "welcome")
    );
  }
};

// --- Blocks and their elements ---

const contactInfoSubfields = ({
  company,
  email,
  firstName,
  lastName,
  phone,
}: TElementOfType<TSurveyElementTypeEnum.ContactInfo>) => [
  { ...company, label: "Company" },
  { ...email, label: "Email" },
  { ...firstName, label: "First Name" },
  { ...lastName, label: "Last Name" },
  { ...phone, label: "Phone" },
];

const addressSubfields = ({
  addressLine1,
  addressLine2,
  city,
  state,
  zip,
  country,
}: TElementOfType<TSurveyElementTypeEnum.Address>) => [
  { ...addressLine1, label: "Address Line 1" },
  { ...addressLine2, label: "Address Line 2" },
  { ...city, label: "City" },
  { ...state, label: "State" },
  { ...zip, label: "Zip" },
  { ...country, label: "Country" },
];

/** Where an element sits, for its issue paths and messages. */
interface TElementLocation {
  blockIndex: number;
  elementIndex: number;
  languages: TSurveyLanguage[];
  ctx: z.RefinementCtx;
}

const elementPath = (loc: TElementLocation, ...rest: (string | number)[]): (string | number)[] => [
  "blocks",
  loc.blockIndex,
  "elements",
  loc.elementIndex,
  ...rest,
];

const elementLabelIssue = (
  loc: TElementLocation,
  field: string,
  label: TI18nString,
  skipArticle?: boolean
): z.core.$ZodRawIssue | null =>
  validateElementLabels(field, label, loc.languages, loc.blockIndex, loc.elementIndex, skipArticle);

/** Adds the label issue, if any, at `path` instead of the validator's own. */
const addElementLabelIssueAt = (
  loc: TElementLocation,
  issue: z.core.$ZodRawIssue | null,
  path: (string | number)[]
): void => {
  if (issue) loc.ctx.addIssue({ ...issue, path });
};

const validateElementTextLabels = (element: TSurveyElement, loc: TElementLocation): void => {
  // Validate headline (required for all elements)
  addIssueIfAny(loc.ctx, elementLabelIssue(loc, "headline", element.headline));

  // Validate subheader if present
  if (element.subheader && element.subheader[DEFAULT_LANGUAGE_CODE].trim() !== "") {
    addIssueIfAny(loc.ctx, elementLabelIssue(loc, "subheader", element.subheader));
  }

  // Validate image alt text if present. An empty default is a decorative image and needs no translations.
  if (element.imageAltText?.[DEFAULT_LANGUAGE_CODE].trim()) {
    addIssueIfAny(loc.ctx, elementLabelIssue(loc, "imageAltText", element.imageAltText));
  }

  if (element.type === TSurveyElementTypeEnum.PictureSelection) {
    element.choices.forEach((choice, choiceIndex) => {
      if (!choice.imageAltText?.[DEFAULT_LANGUAGE_CODE]?.trim()) return;
      addElementLabelIssueAt(
        loc,
        elementLabelIssue(
          loc,
          `Image alt text of choice ${String(choiceIndex + 1)}`,
          choice.imageAltText,
          true
        ),
        elementPath(loc, "choices", choiceIndex, "imageAltText")
      );
    });
  }
};

const validateOpenTextElement = (
  element: TElementOfType<TSurveyElementTypeEnum.OpenText>,
  loc: TElementLocation
): void => {
  if (hasDefaultText(element.placeholder) && loc.languages.length > 1) {
    addIssueIfAny(loc.ctx, elementLabelIssue(loc, "placeholder", element.placeholder));
  }
};

const validateElementChoices = (
  element: TElementOfType<
    | TSurveyElementTypeEnum.MultipleChoiceSingle
    | TSurveyElementTypeEnum.MultipleChoiceMulti
    | TSurveyElementTypeEnum.Ranking
  >,
  loc: TElementLocation
): void => {
  element.choices.forEach((choice, choiceIndex) => {
    addElementLabelIssueAt(
      loc,
      elementLabelIssue(loc, `Choice ${String(choiceIndex + 1)}`, choice.label, true),
      elementPath(loc, "choices", choiceIndex)
    );
  });

  addIssueIfAny(
    loc.ctx,
    duplicateLabelsIssue(
      element.choices.map((choice) => choice.label),
      loc.languages,
      `Element ${String(loc.elementIndex + 1)} in block ${String(loc.blockIndex + 1)} has duplicate choice labels`,
      elementPath(loc, "choices")
    )
  );
};

const validateCtaElement = (
  element: TElementOfType<TSurveyElementTypeEnum.CTA>,
  loc: TElementLocation
): void => {
  // Only validate buttonExternal fields when buttonExternal is true
  if (!element.buttonExternal) return;

  // Validate ctaButtonLabel when buttonExternal is enabled
  addElementLabelIssueAt(
    loc,
    elementLabelIssue(loc, "ctaButtonLabel", element.ctaButtonLabel ?? {}),
    elementPath(loc, "ctaButtonLabel")
  );

  // Validate buttonUrl when buttonExternal is enabled
  addIssueIfAny(
    loc.ctx,
    urlFieldIssue(
      element.buttonUrl,
      getZSafeUrl,
      `Element ${String(loc.elementIndex + 1)} in block ${String(loc.blockIndex + 1)}`,
      "Button URL is required when external button is enabled",
      elementPath(loc, "buttonUrl")
    )
  );
};

const validateMatrixElement = (
  element: TElementOfType<TSurveyElementTypeEnum.Matrix>,
  loc: TElementLocation
): void => {
  element.rows.forEach((row, rowIndex) => {
    addElementLabelIssueAt(
      loc,
      elementLabelIssue(loc, `Row ${String(rowIndex + 1)}`, row.label, true),
      elementPath(loc, "rows", rowIndex)
    );
  });

  element.columns.forEach((column, columnIndex) => {
    addElementLabelIssueAt(
      loc,
      elementLabelIssue(loc, `Column ${String(columnIndex + 1)}`, column.label, true),
      elementPath(loc, "columns", columnIndex)
    );
  });

  const where = `Question ${String(loc.elementIndex + 1)} in block ${String(loc.blockIndex + 1)}`;
  addIssueIfAny(
    loc.ctx,
    duplicateLabelsIssue(
      element.rows.map((row) => row.label),
      loc.languages,
      `${where} has duplicate row labels`,
      elementPath(loc, "rows")
    )
  );

  addIssueIfAny(
    loc.ctx,
    duplicateLabelsIssue(
      element.columns.map((column) => column.label),
      loc.languages,
      `${where} has duplicate column labels`,
      elementPath(loc, "columns")
    )
  );
};

/**
 * At least one sub-field of a contact-info or address element shows, and each shown one is translated.
 * `toPathKey` turns a sub-field's label into its issue path key.
 */
const validateElementSubfields = (
  fields: TLabelledSubfield[],
  elementName: string,
  toPathKey: (label: string) => string,
  loc: TElementLocation
): void => {
  if (fields.every((field) => !field.show)) {
    loc.ctx.addIssue({
      code: "custom",
      message: `At least one field must be shown in the ${elementName} question ${String(loc.elementIndex + 1)} in block ${String(loc.blockIndex + 1)}`,
      path: elementPath(loc),
    });
  }
  fields.forEach((field) => {
    if (!field.show) return;
    addElementLabelIssueAt(
      loc,
      elementLabelIssue(loc, `Label for field ${field.label}`, field.placeholder, true),
      elementPath(loc, toPathKey(field.label))
    );
  });
};

/** The checks only some element types have. */
const validateElementByType = (element: TSurveyElement, loc: TElementLocation): void => {
  const where = `Question ${String(loc.elementIndex + 1)} in block ${String(loc.blockIndex + 1)}`;
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      validateOpenTextElement(element, loc);
      break;
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.Ranking:
      validateElementChoices(element, loc);
      break;
    case TSurveyElementTypeEnum.Consent:
      addElementLabelIssueAt(
        loc,
        elementLabelIssue(loc, "consent.label", element.label),
        elementPath(loc, "label")
      );
      break;
    case TSurveyElementTypeEnum.CTA:
      validateCtaElement(element, loc);
      break;
    case TSurveyElementTypeEnum.Matrix:
      validateMatrixElement(element, loc);
      break;
    case TSurveyElementTypeEnum.FileUpload:
      if (element.allowedFileExtensions?.length === 0) {
        loc.ctx.addIssue({
          code: "custom",
          message: `${where} must have atleast one allowed file extension`,
          path: elementPath(loc, "allowedFileExtensions"),
        });
      }
      break;
    case TSurveyElementTypeEnum.Cal:
      if (element.calHost !== undefined && !CAL_HOSTNAME_REGEX.test(element.calHost)) {
        loc.ctx.addIssue({
          code: "custom",
          message: `${where} must have a valid host name`,
          path: elementPath(loc, "calHost"),
        });
      }
      break;
    case TSurveyElementTypeEnum.ContactInfo:
      // Only the first space is dropped from the path key ("firstname", "lastname").
      validateElementSubfields(
        contactInfoSubfields(element),
        "Contact Info",
        (label) => label.toLowerCase().replace(" ", ""),
        loc
      );
      break;
    case TSurveyElementTypeEnum.Address:
      validateElementSubfields(
        addressSubfields(element),
        "Address",
        (label) => label.toLowerCase().replace(/ /g, ""),
        loc
      );
      break;
    default:
      break;
  }
};

/** Block IDs are unique (CUIDs should be unique by design, but validate anyway). */
const validateUniqueBlockIds = (blocks: TSurveyBlock[], ctx: z.RefinementCtx): void => {
  const blockIds = blocks.map((b) => b.id);
  const uniqueBlockIds = new Set(blockIds);
  if (uniqueBlockIds.size !== blockIds.length) {
    ctx.addIssue({
      code: "custom",
      message: "Block IDs must be unique",
      path: ["blocks", blockIds.findIndex((id, index) => blockIds.indexOf(id) !== index), "id"],
    });
  }
};

/** Every element across all blocks by id, reporting an id used twice. */
const indexBlockElements = (blocks: TSurveyBlock[], ctx: z.RefinementCtx): TElementPositions => {
  const allElements = new Map<string, { block: number; element: number; data: TSurveyElement }>();
  blocks.forEach((block, blockIdx) => {
    block.elements.forEach((element, elemIdx) => {
      if (allElements.has(element.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Element ID "${element.id}" is used in multiple blocks. Element IDs must be unique across all blocks.`,
          path: ["blocks", blockIdx, "elements", elemIdx, "id"],
        });
      }
      allElements.set(element.id, { block: blockIdx, element: elemIdx, data: element });
    });
  });
  return allElements;
};

const addIssues = (issues: z.core.$ZodIssue[], ctx: z.RefinementCtx): void => {
  issues.forEach((issue) => {
    ctx.addIssue(issue as z.core.$ZodRawIssue);
  });
};

const validateBlocks = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  const { blocks, languages } = survey;
  // 1. Validate block IDs are unique
  validateUniqueBlockIds(blocks, ctx);

  // 2. Build map of all elements across all blocks
  const allElements = indexBlockElements(blocks, ctx);

  // 4. Detailed validation for each block and its elements
  blocks.forEach((block, blockIndex) => {
    // Validate each element in the block
    block.elements.forEach((element, elementIndex) => {
      const loc: TElementLocation = { blockIndex, elementIndex, languages, ctx };
      validateElementTextLabels(element, loc);
      // Type-specific validation
      validateElementByType(element, loc);
    });

    // Validate block logic (conditions, actions, fallback)
    addIssues(validateBlockLogic(survey, blockIndex, block, allElements), ctx);

    // Show-if on the block and its elements (ENG-6931)
    addIssues(validateShowIf(survey, blockIndex, block, allElements), ctx);
  });

  // Copied options (ENG-6938): the source exists, comes earlier and has options of the same kind.
  getCopiedOptionsIssues(blocks).forEach(({ path, message }) => {
    ctx.addIssue({ code: "custom", message, path });
  });

  // Rules before the first question: jumps and Set value only, reading fields, never answers.
  addIssues(validateStartLogic(survey), ctx);

  // 5. Check for cyclic logic in blocks
  findBlocksWithCyclicLogic(blocks).forEach((blockId) => {
    const blockIndex = blocks.findIndex((b) => b.id === blockId);
    if (blockIndex !== -1) {
      ctx.addIssue({
        code: "custom",
        message: `Conditional Logic: Cyclic logic detected in block ${String(blockIndex + 1)} (${blocks[blockIndex].name}).`,
        path: ["blocks", blockIndex, "logic"],
      });
    }
  });
};

// --- Endings ---

const validateEndScreenButton = (
  ending: Extract<TSurveyInput["endings"][number], { type: "endScreen" }>,
  index: number,
  languages: TSurveyLanguage[],
  ctx: z.RefinementCtx
): void => {
  if (ending.buttonLabel === undefined && ending.buttonLink === undefined) return;

  if (ending.buttonLabel) {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("endingCardButtonLabel", ending.buttonLabel, languages, "end", index)
    );
  } else {
    ctx.addIssue({
      code: "custom",
      message: `Ending card ${String(index + 1)}: Button label cannot be empty`,
      path: ["endings", index, "buttonLabel"],
    });
  }

  addIssueIfAny(
    ctx,
    urlFieldIssue(
      ending.buttonLink,
      ZEndingCardButtonLink,
      `Ending card ${String(index + 1)}`,
      "Button link cannot be empty",
      ["endings", index, "buttonLink"]
    )
  );
};

/** Thank you card validations. */
const validateEndScreen = (
  ending: Extract<TSurveyInput["endings"][number], { type: "endScreen" }>,
  index: number,
  languages: TSurveyLanguage[],
  ctx: z.RefinementCtx
): void => {
  addIssueIfAny(
    ctx,
    validateCardFieldsForAllLanguages("cardHeadline", ending.headline ?? {}, languages, "end", index)
  );

  if (ending.subheader) {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("subheader", ending.subheader, languages, "end", index)
    );
  }

  if (ending.imageAltText?.default.trim()) {
    addIssueIfAny(
      ctx,
      validateCardFieldsForAllLanguages("imageAltText", ending.imageAltText, languages, "end", index)
    );
  }

  validateEndScreenButton(ending, index, languages, ctx);
};

const validateRedirectEnding = (
  ending: Extract<TSurveyInput["endings"][number], { type: "redirectToUrl" }>,
  index: number,
  ctx: z.RefinementCtx
): void => {
  if (!ending.label || ending.label.trim() === "") {
    ctx.addIssue({
      code: "custom",
      message: `Redirect Url label cannot be empty for ending Card ${String(index + 1)}.`,
      path: ["endings", index, "label"],
    });
  }

  // Validate redirect URL
  addIssueIfAny(
    ctx,
    urlFieldIssue(
      ending.url,
      ZEndingCardUrl,
      `Ending card ${String(index + 1)}`,
      "Redirect URL cannot be empty",
      ["endings", index, "url"]
    )
  );
};

const validateEndings = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  survey.endings.forEach((ending, index) => {
    if (ending.type === "endScreen") validateEndScreen(ending, index, survey.languages, ctx);
    if (ending.type === "redirectToUrl") validateRedirectEnding(ending, index, ctx);
  });
};

// --- Follow-ups ---

/** The survey's own fields a follow-up email may be sent to. */
const followUpRecipientOptions = (survey: TSurveyInput): string[] => {
  const questionsFromBlocks = survey.blocks.flatMap((block: TSurveyBlock) => block.elements);
  return [
    "verifiedEmail", // Allow verified email from email verification feature
    ...questionsFromBlocks
      .filter((q) => {
        if (q.type === TSurveyElementTypeEnum.OpenText) {
          return q.inputType === "email";
        }

        if (q.type === TSurveyElementTypeEnum.ContactInfo) {
          return q.email.show;
        }

        return false;
      })
      .map((q) => q.id),
    ...(survey.hiddenFields.fieldIds ?? []),
  ];
};

const validateFollowUps = (survey: TSurveyInput, ctx: z.RefinementCtx): void => {
  if (!survey.followUps.length) return;

  const validOptions = followUpRecipientOptions(survey);

  survey.followUps
    .filter((followUp) => !followUp.deleted)
    .forEach((followUp, index) => {
      if (!followUp.action.properties.to) return;

      // not from a valid option within the survey, but it could be a correct email from the team
      // member emails or the user's email:
      if (
        !validOptions.includes(followUp.action.properties.to) &&
        !z.email().safeParse(followUp.action.properties.to).success
      ) {
        ctx.addIssue({
          code: "custom",
          message: `The action in follow up ${String(index + 1)} has an invalid email field`,
          path: ["followUps"],
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- endingIds is always defined
      if (followUp.trigger.type === "endings" && !followUp.trigger.properties?.endingIds?.length) {
        ctx.addIssue({
          code: "custom",
          message: `The trigger in follow up ${String(index + 1)} has no ending selected`,
          path: ["followUps"],
        });
      }
    });
};

export const surveyRefinement = (rawSurvey: TSurveyInput, ctx: z.RefinementCtx): void => {
  const survey = withDerivedLegacyColumns(rawSurvey);
  const { questions, blocks, languages, isBackButtonHidden } = survey;
  let multiLangIssue: z.core.$ZodRawIssue | null;

  validateDerivedVariables(survey, ctx);

  const hasQuestions = questions.length > 0;
  const hasBlocks = blocks.length > 0 && blocks.some((b) => b.elements.length > 0);
  validateSurveyModel(hasQuestions, hasBlocks, ctx);

  if (hasBlocks) validateSurveyCodeNames(survey, ctx);

  validateWelcomeCard(survey, ctx);

  // Custom default validation for each question
  if (hasQuestions) {
    // eslint-disable-next-line sonarjs/cognitive-complexity -- the v1 questions-model validator is frozen: splitting it would re-mark its deprecated TSurveyQuestion* references as new code
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
        (question.type === TSurveyQuestionTypeEnum.NPS || question.type === TSurveyQuestionTypeEnum.Rating) &&
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
          const invalidLanguageCodes = resolveDefaultLanguageCode(duplicateChoicesLanguageCodes, languages);

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: "custom",
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
              code: "custom",
              message: `Question ${String(questionIndex + 1)}: Button URL is required when external button is enabled`,
              path: ["questions", questionIndex, "buttonUrl"],
            });
          } else {
            const parsedButtonUrl = getZSafeUrl.safeParse(question.buttonUrl);
            if (!parsedButtonUrl.success) {
              const errorMessage = parsedButtonUrl.error.issues[0].message;
              ctx.addIssue({
                code: "custom",
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
          const invalidLanguageCodes = resolveDefaultLanguageCode(duplicateRowsLanguageCodes, languages);

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: "custom",
            message: `Question ${String(questionIndex + 1)} has duplicate row labels ${isDefaultOnly ? "" : "for the following languages:"}`,
            path: ["questions", questionIndex, "rows"],
            params: isDefaultOnly ? undefined : { invalidLanguageCodes },
          });
        }

        if (duplicateColumnLanguageCodes.length > 0) {
          const invalidLanguageCodes = resolveDefaultLanguageCode(duplicateColumnLanguageCodes, languages);

          const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";

          ctx.addIssue({
            code: "custom",
            message: `Question ${String(questionIndex + 1)} has duplicate column labels ${isDefaultOnly ? "" : "for the following languages:"}`,
            path: ["questions", questionIndex, "columns"],
            params: isDefaultOnly ? undefined : { invalidLanguageCodes },
          });
        }
      }

      if (question.type === TSurveyQuestionTypeEnum.FileUpload) {
        // allowedFileExtensions must have atleast one element
        if (question.allowedFileExtensions?.length === 0) {
          ctx.addIssue({
            code: "custom",
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
              code: "custom",
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
            code: "custom",
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
            code: "custom",
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
          ctx.addIssue(issue as z.core.$ZodRawIssue);
        });
      }
    });

    const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(questions);
    if (questionsWithCyclicLogic.length > 0) {
      questionsWithCyclicLogic.forEach((questionId) => {
        const questionIndex = questions.findIndex((q) => q.id === questionId);
        ctx.addIssue({
          code: "custom",
          message: `Conditional Logic: Cyclic logic detected 🔃 Please check the logic of question ${String(questionIndex + 1)}.`,
          path: ["questions", questionIndex, "logic"],
        });
      });
    }
  }

  if (hasBlocks) validateBlocks(survey, ctx);

  validateEndings(survey, ctx);

  validateFollowUps(survey, ctx);
};

export const ZSurvey = ZSurveyBase.superRefine(surveyRefinement);

/* eslint-disable sonarjs/cognitive-complexity -- the v1 questions-model validator is frozen: splitting it would re-mark its deprecated TSurveyQuestion* references as new code */
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
              "isValidEmail",
              "isValidUrl",
              "isValidCountry",
              "isValidCity",
              "isLongerThan",
              "isLongerThanOrEqual",
              "isShorterThan",
              "isShorterThanOrEqual",
              "matchesRegex",
              "isGreaterThan",
              "isGreaterThanOrEqual",
              "isLessThan",
              "isLessThanOrEqual",
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
    case TSurveyQuestionTypeEnum.Signature: // NOSONAR the legacy question switch has to name the legacy enum member
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
/* eslint-enable sonarjs/cognitive-complexity */

/**
 * Compile-time exhaustiveness guard for a left-operand chain. The parameter is `never`, so passing a
 * still-possible operand type is a type error, and adding a member to `ZDynamicLogicFieldValue` fails
 * the build at every chain that has not learned about it.
 *
 * This exists because ENG-1840 added `reserved` to that union and two validators here kept treating
 * it as a hidden field for a whole milestone — a bare `else` commented `leftOperand.type ===
 * "hiddenField"` accepted the new member silently, and every survey with a logic condition on a
 * reserved field became unsaveable (ENG-2538). A type error is what that should have been.
 *
 * Does nothing at runtime, deliberately: a stored survey that somehow carries an unknown operand
 * should still validate rather than throw inside a Zod refinement.
 */
const assertNoUnhandledLeftOperand = (_leftOperand: never): void => {
  // Exhaustiveness is enforced entirely by the parameter type.
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
): z.core.$ZodIssue[] => {
  const issues: z.core.$ZodIssue[] = [];

  // eslint-disable-next-line sonarjs/cognitive-complexity -- the v1 questions-model validator is frozen: splitting it would re-mark its deprecated TSurveyQuestion* references as new code
  const validateSingleCondition = (condition: TSingleConditionDeprecated): void => {
    const { leftOperand, operator, rightOperand } = condition;

    // Validate left operand
    if (leftOperand.type === "question") {
      const questionId = leftOperand.value;
      const questionIdx = survey.questions.findIndex((q) => q.id === questionId);
      const question = questionIdx !== -1 ? survey.questions[questionIdx] : undefined;

      if (!question) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
        return;
      } else if (questionIndex < questionIdx) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Question ${String(questionIndex + 1)} cannot refer to a question ${String(questionIdx + 1)} that appears later in the survey`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
        return;
      }

      // Validate operator based on question type
      const isInvalidOperator = isInvalidOperatorsForQuestionType(question, operator);
      if (isInvalidOperator) {
        issues.push({
          code: "custom",
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
            code: "custom",
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
              code: "custom",
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
                code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

          if (!field) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (rightOperand.value === "") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Static value is required in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      } else if (question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle) {
        if (rightOperand?.type !== "static") {
          issues.push({
            code: "custom",
            message: `Conditional Logic: Right operand should be a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const choice = question.choices.find((c) => c.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: "custom",
                message: `Conditional Logic: Choice with label "${rightOperand.value}" does not exist in question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          }
        } else if (condition.operator === "equalsOneOf") {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: "custom",
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
                });
              }
            });

            const choices = question.choices.map((c) => c.id);

            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: "custom",
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
            code: "custom",
            message: `Conditional Logic: Right operand should be amongst the choice values for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const choice = question.choices.find((c) => c.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: "custom",
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
                });
              }
            });

            const choices = question.choices.map((c) => c.id);

            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "number") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Variable type should be number in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          if (typeof rightOperand.value !== "number") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Right operand should be a number for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (question.type === TSurveyQuestionTypeEnum.NPS) {
            if (rightOperand.value < 0 || rightOperand.value > 10) {
              issues.push({
                code: "custom",
                message: `Conditional Logic: NPS score should be between 0 and 10 for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
          } else if (rightOperand.value < 1 || rightOperand.value > question.range) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Rating value should be between 1 and ${String(question.range)} for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          issues.push({
            code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else {
            const validQuestionTypes = [TSurveyQuestionTypeEnum.OpenText, TSurveyQuestionTypeEnum.Date];
            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== "text") {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const doesFieldExists = survey.hiddenFields.fieldIds?.includes(fieldId);

          if (!doesFieldExists) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "static") {
          const date = rightOperand.value as string;

          if (!date) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Please select a date value in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (isNaN(new Date(date).getTime())) {
            issues.push({
              code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Right operand is not allowed in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (!["isPartiallySubmitted", "isCompletelySubmitted"].includes(operator)) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Operator "${operator}" is not allowed in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else {
          if (rightOperand === undefined) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Right operand is required in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
          if (rightOperand) {
            if (rightOperand.type !== "static") {
              issues.push({
                code: "custom",
                message: `Conditional Logic: Right operand should be a static value in matrix question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
              });
            }
            const rowIndex = Number(row);
            if (rowIndex < 0 || rowIndex >= question.rows.length) {
              issues.push({
                code: "custom",
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
          code: "custom",
          message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      } else {
        // Validate operator based on variable type
        const isInvalidOperator = isInvalidOperatorsForVariableType(variable.type, operator);
        if (isInvalidOperator) {
          issues.push({
            code: "custom",
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
              code: "custom",
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
                code: "custom",
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
                code: "custom",
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
              code: "custom",
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          } else if (variable.type !== foundVariable.type) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Variable type mismatch in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        } else if (rightOperand?.type === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

          if (!field) {
            issues.push({
              code: "custom",
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
            });
          }
        }
      }
    } else if (leftOperand.type === "element") {
      // Nothing to check: `element` is the blocks-era operand and this validator resolves against
      // `survey.questions`. It was already dropping out of this chain unvalidated — spelled out so the
      // guard at the end can be exhaustive without changing what the validator accepts.
    } else if (leftOperand.type === "reserved") {
      // Same as the block-path arm below — see the comment there. The legacy validator carried the
      // identical bare `else`, so a reserved operand on a questions-shaped survey was reported as a
      // missing hidden field too.
      // Checked rather than a bare `else`: this comes from persisted JSON parsed by a lenient
      // schema, so a row from a different catalog version can carry a `type` outside the union.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
    } else if (leftOperand.type === "hiddenField") {
      const hiddenFieldId = leftOperand.value;
      const hiddenField = survey.hiddenFields.fieldIds?.find((fieldId) => fieldId === hiddenFieldId);

      if (!hiddenField) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Hidden field ID ${hiddenFieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
        });
      }

      // Validate operator based on hidden field type
      const isInvalidOperator = isInvalidOperatorsForHiddenFieldType(operator);
      if (isInvalidOperator) {
        issues.push({
          code: "custom",
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
            code: "custom",
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
              code: "custom",
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
            code: "custom",
            message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        } else if (variable.type !== "text") {
          issues.push({
            code: "custom",
            message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
      } else if (rightOperand?.type === "hiddenField") {
        const fieldId = rightOperand.value;
        const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

        if (!field) {
          issues.push({
            code: "custom",
            message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"],
          });
        }
      }
    } else {
      // The block-path chain's guard, on the second of the two chains that carried the ENG-2538 bug.
      // Without it `assertNoUnhandledLeftOperand`'s own promise — a build failure at *every* chain
      // that has not learned about a new member — held for only one of them.
      assertNoUnhandledLeftOperand(leftOperand);
    }
  };

  const validateConditionGroup = (group: TConditionGroup | TConditionGroupDeprecated): void => {
    group.conditions.forEach((condition) => {
      // Check if it's a group by checking for "conditions" property
      if ("conditions" in condition && "connector" in condition) {
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
): z.core.$ZodIssue[] => {
  const previousQuestions = survey.questions.filter((_, idx) => idx <= questionIndex);
  const nextQuestions = survey.questions.filter((_, idx) => idx >= questionIndex);
  const nextQuestionsIds = nextQuestions.map((q) => q.id);

  // eslint-disable-next-line sonarjs/cognitive-complexity -- the v1 questions-model validator is frozen: splitting it would re-mark its deprecated TSurveyQuestion* references as new code
  const actionIssues: (z.core.$ZodIssue | undefined)[] = actions.map((action) => {
    if (action.objective === "calculate") {
      const variable = survey.variables.find((v) => v.id === action.variableId);

      if (!variable) {
        return {
          code: "custom",
          message: `Conditional Logic: Variable ID ${action.variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex],
        };
      }

      if (action.value.type === "variable") {
        const selectedVariable = survey.variables.find((v) => v.id === action.value.value);

        if (selectedVariable?.type !== variable.type) {
          return {
            code: "custom",
            message: `Conditional Logic: Invalid variable type for variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }
      }

      if (variable.type === "text") {
        const textVariableParseData = ZActionCalculateText.safeParse(action);
        if (!textVariableParseData.success) {
          return {
            code: "custom",
            message: textVariableParseData.error.issues[0].message,
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
              code: "custom",
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
          code: "custom",
          message: numberVariableParseData.error.issues[0].message,
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
            code: "custom",
            message: `Conditional Logic: Invalid question type for number variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex],
          };
        }
      }
    } else if (action.objective === "jumpToQuestion" || action.objective === "requireAnswer") {
      const endingIds = survey.endings.map((ending) => ending.id);

      const possibleQuestionIds =
        action.objective === "jumpToQuestion" ? [...nextQuestionsIds, ...endingIds] : nextQuestionsIds;

      if (!possibleQuestionIds.includes(action.target)) {
        return {
          code: "custom",
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
            code: "custom",
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
      code: "custom",
      message: `Conditional Logic: Multiple jump actions are not allowed in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
      path: ["questions", questionIndex, "logic"],
    });
  }

  const filteredActionIssues = actionIssues.filter((issue): issue is z.core.$ZodIssue => issue !== undefined);
  return filteredActionIssues;
};

const validateLogicFallback = (survey: TSurvey, questionIdx: number): z.core.$ZodIssue[] | undefined => {
  const question = survey.questions[questionIdx];

  if (!question.logicFallback) return;

  if (!question.logic?.length && question.logicFallback) {
    return [
      {
        code: "custom",
        message: `Conditional Logic: Fallback logic is defined without any logic in question ${String(questionIdx + 1)}`,
        path: ["questions", questionIdx],
      },
    ];
  } else if (question.id === question.logicFallback) {
    return [
      {
        code: "custom",
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

  survey.endings.forEach((e: TSurveyEnding) => {
    possibleFallbackIds.push(e.id);
  });

  if (!possibleFallbackIds.includes(question.logicFallback)) {
    return [
      {
        code: "custom",
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
): z.core.$ZodIssue[] => {
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

type TOperatorList = readonly TSurveyLogicConditionsOperator[];

const ELEMENT_TEXT_OPERATORS: TOperatorList = [
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
];
const ELEMENT_NUMBER_OPERATORS: TOperatorList = [
  "equals",
  "doesNotEqual",
  "isLessThan",
  "isLessThanOrEqual",
  "isGreaterThan",
  "isGreaterThanOrEqual",
  "isSubmitted",
  "isSkipped",
];
const ELEMENT_MULTI_SELECT_OPERATORS: TOperatorList = [
  "equals",
  "doesNotEqual",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
  "isSubmitted",
  "isSkipped",
];
const ELEMENT_SUBMITTED_OPERATORS: TOperatorList = ["isSubmitted", "isSkipped"];

/** The operators an open-text element allows, by input type. Other input types allow every operator. */
const OPEN_TEXT_ELEMENT_OPERATORS: Partial<Record<string, TOperatorList>> = {
  email: ELEMENT_TEXT_OPERATORS,
  phone: ELEMENT_TEXT_OPERATORS,
  text: ELEMENT_TEXT_OPERATORS,
  url: ELEMENT_TEXT_OPERATORS,
  number: ELEMENT_NUMBER_OPERATORS,
};

/** The operators each element type allows. A type not listed here allows every operator. */
const ELEMENT_OPERATORS: Partial<Record<TSurveyElementTypeEnum, TOperatorList>> = {
  [TSurveyElementTypeEnum.MultipleChoiceSingle]: [
    "equals",
    "doesNotEqual",
    "equalsOneOf",
    "isSubmitted",
    "isSkipped",
  ],
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: ELEMENT_MULTI_SELECT_OPERATORS,
  [TSurveyElementTypeEnum.PictureSelection]: ELEMENT_MULTI_SELECT_OPERATORS,
  // T21 (ENG-6937): both engines map a ranking's stored labels back to option ids, so "was ranked"
  // conditions match. Equality is left out: a ranking is an order, not a set.
  [TSurveyElementTypeEnum.Ranking]: [
    "includesAllOf",
    "includesOneOf",
    "doesNotIncludeAllOf",
    "doesNotIncludeOneOf",
    "isSubmitted",
    "isSkipped",
  ],
  [TSurveyElementTypeEnum.FileUpload]: ELEMENT_SUBMITTED_OPERATORS,
  [TSurveyElementTypeEnum.Signature]: ELEMENT_SUBMITTED_OPERATORS,
  [TSurveyElementTypeEnum.NPS]: ELEMENT_NUMBER_OPERATORS,
  [TSurveyElementTypeEnum.Rating]: ELEMENT_NUMBER_OPERATORS,
  [TSurveyElementTypeEnum.CSAT]: ELEMENT_NUMBER_OPERATORS,
  [TSurveyElementTypeEnum.CES]: ELEMENT_NUMBER_OPERATORS,
  [TSurveyElementTypeEnum.CTA]: ["isClicked", "isNotClicked"],
  [TSurveyElementTypeEnum.Consent]: ["isAccepted", "isSkipped"],
  [TSurveyElementTypeEnum.Cal]: ["isBooked", "isSkipped"],
  [TSurveyElementTypeEnum.Date]: [
    "equals",
    "doesNotEqual",
    "isBefore",
    "isAfter",
    "isSubmitted",
    "isSkipped",
  ],
  [TSurveyElementTypeEnum.Matrix]: [
    "isPartiallySubmitted",
    "isCompletelySubmitted",
    "isSkipped",
    "isEmpty",
    "isNotEmpty",
    "isAnyOf",
    "equals",
    "doesNotEqual",
  ],
  [TSurveyElementTypeEnum.Address]: ELEMENT_SUBMITTED_OPERATORS,
  [TSurveyElementTypeEnum.ContactInfo]: ELEMENT_SUBMITTED_OPERATORS,
};

// Looked up through Maps, so a prototype key (`constructor`, `toString`) has no entry. Not
// `Object.hasOwn`: this package compiles against ES2021.
const OPEN_TEXT_ELEMENT_OPERATOR_MAP = new Map(Object.entries(OPEN_TEXT_ELEMENT_OPERATORS));
const ELEMENT_OPERATOR_MAP = new Map(Object.entries(ELEMENT_OPERATORS));

const isInvalidOperatorsForElementType = (
  element: TSurveyElement,
  operator: TSurveyLogicConditionsOperator
): boolean => {
  if (element.required && operator === "isSkipped") return true;

  const allowedOperators =
    element.type === TSurveyElementTypeEnum.OpenText
      ? OPEN_TEXT_ELEMENT_OPERATOR_MAP.get(element.inputType)
      : ELEMENT_OPERATOR_MAP.get(element.type);

  return allowedOperators !== undefined && !allowedOperators.includes(operator);
};

/**
 * Where a condition group lives, for its error messages: the issue `path`, the `where` phrase that
 * ends a message ("logic no: 2 of block 3"), and whether an element in a later block is reported
 * here. Show-if reports its stricter reference rule itself, with exact paths (`validateShowIf`).
 */
interface TConditionScope {
  path: (string | number)[];
  where: string;
  checkLaterBlock: boolean;
}

/** A condition group being validated: its survey, element positions and scope, and its issue sink. */
interface TConditionCheck {
  survey: TSurvey;
  allElements: TElementPositions;
  scope: TConditionScope;
  /** Adds an issue at the group's path; `message` follows the "Conditional Logic: " prefix. */
  report: (message: string) => void;
}

type TStaticRightOperand = Extract<NonNullable<TSingleCondition["rightOperand"]>, { type: "static" }>;

/** Operators that take no right operand on an element condition. */
const ELEMENT_OPERATORS_WITHOUT_RIGHT_OPERAND = [
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
];

const ELEMENT_ARRAY_CHOICE_OPERATORS = [
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
];

/** Reports a right-operand computed field that does not exist, or (with `expectedType`) is of another type. */
const checkVariableOperand = (
  check: TConditionCheck,
  variableId: string,
  expectedType?: "number" | "text"
): void => {
  const variable = findLogicComputedField(check.survey, variableId);
  if (!variable) {
    check.report(`Variable ID ${variableId} does not exist in ${check.scope.where}`);
  } else if (expectedType && variable.type !== expectedType) {
    check.report(`Variable type should be ${expectedType} in ${check.scope.where}`);
  }
};

/** Reports a right-operand element that does not exist, or whose type is not in `validTypes`. */
const checkElementOperand = (
  check: TConditionCheck,
  elementId: string,
  validTypes: TSurveyElementTypeEnum[]
): void => {
  const elem = check.allElements.get(elementId);
  if (!elem) {
    check.report(`Element ID ${elementId} does not exist in ${check.scope.where}`);
  } else if (!validTypes.includes(elem.data.type)) {
    check.report(`Invalid element type "${elem.data.type}" for right operand in ${check.scope.where}`);
  }
};

const validateOpenTextElementCondition = (
  element: TElementOfType<TSurveyElementTypeEnum.OpenText>,
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  const { rightOperand } = condition;
  const { where } = check.scope;
  switch (rightOperand?.type) {
    case "element": {
      const validElementTypes: TSurveyElementTypeEnum[] = [TSurveyElementTypeEnum.OpenText];

      if (element.inputType === "number") {
        validElementTypes.push(...[TSurveyElementTypeEnum.Rating, TSurveyElementTypeEnum.NPS]);
      }

      if (["equals", "doesNotEqual"].includes(condition.operator) && element.inputType !== "number") {
        validElementTypes.push(
          ...[
            TSurveyElementTypeEnum.Date,
            TSurveyElementTypeEnum.MultipleChoiceSingle,
            TSurveyElementTypeEnum.MultipleChoiceMulti,
          ]
        );
      }
      checkElementOperand(check, rightOperand.value, validElementTypes);
      break;
    }
    case "variable":
      checkVariableOperand(check, rightOperand.value);
      break;
    case "hiddenField":
      if (!check.survey.hiddenFields.fieldIds?.find((id) => id === rightOperand.value)) {
        check.report(`Hidden field ID ${rightOperand.value} does not exist in ${where}`);
      }
      break;
    case "static":
      if (rightOperand.value === "") {
        check.report(`Static value is required in ${where}`);
      }
      break;
    default:
      break;
  }
};

/**
 * A static choice operand: one existing choice id for equality and, where `allowArrays`, an array of
 * existing ones for the includes operators.
 */
const validateChoiceElementOperand = (
  element: TElementOfType<
    | TSurveyElementTypeEnum.MultipleChoiceSingle
    | TSurveyElementTypeEnum.MultipleChoiceMulti
    | TSurveyElementTypeEnum.PictureSelection
    | TSurveyElementTypeEnum.Ranking
  >,
  elementPosition: { block: number; element: number },
  rightOperand: TStaticRightOperand,
  operator: string,
  allowArrays: boolean,
  check: TConditionCheck
): void => {
  const { where } = check.scope;
  if (operator === "equals" || operator === "doesNotEqual") {
    if (typeof rightOperand.value !== "string") {
      check.report(`Right operand should be a string for "${operator}" in ${where}`);
    } else if (!element.choices.find((c) => c.id === rightOperand.value)) {
      // Validate that the choice ID exists in the element's choices
      check.report(
        `Choice "${rightOperand.value}" does not exist in element ${String(elementPosition.element + 1)} of block ${String(elementPosition.block + 1)}`
      );
    }
    return;
  }

  if (!allowArrays || !ELEMENT_ARRAY_CHOICE_OPERATORS.includes(operator)) return;

  if (!Array.isArray(rightOperand.value)) {
    check.report(`Right operand should be an array for "${operator}" in ${where}`);
    return;
  }

  rightOperand.value.forEach((value) => {
    if (typeof value !== "string") {
      check.report(`Each value in the right operand should be a string for "${operator}" in ${where}`);
    }
  });

  // Validate that all choice IDs exist in the element's choices
  const choiceIds = element.choices.map((c) => c.id);
  if (rightOperand.value.some((value) => !choiceIds.includes(value))) {
    check.report(`One or more choices selected in right operand do not exist in the element in ${where}`);
  }
};

const validateRatingElementCondition = (
  element: TElementOfType<TSurveyElementTypeEnum.NPS | TSurveyElementTypeEnum.Rating>,
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  const { rightOperand, operator } = condition;
  const { where } = check.scope;
  if (rightOperand?.type === "variable") {
    checkVariableOperand(check, rightOperand.value, "number");
    return;
  }
  if (rightOperand?.type !== "static") {
    check.report(`Right operand should be a variable or a static value for "${operator}" in ${where}`);
    return;
  }

  if (typeof rightOperand.value !== "number") {
    check.report(`Right operand should be a number for "${operator}" in ${where}`);
  } else if (element.type === TSurveyElementTypeEnum.NPS) {
    if (rightOperand.value < 0 || rightOperand.value > 10) {
      check.report(`NPS score should be between 0 and 10 for "${operator}" in ${where}`);
    }
  } else if (rightOperand.value < 1 || rightOperand.value > element.range) {
    check.report(
      `Rating value should be between 1 and ${String(element.range)} for "${operator}" in ${where}`
    );
  }
};

const validateDateElementCondition = (condition: TSingleCondition, check: TConditionCheck): void => {
  const { rightOperand } = condition;
  const { where } = check.scope;
  switch (rightOperand?.type) {
    case "element":
      checkElementOperand(check, rightOperand.value, [
        TSurveyElementTypeEnum.OpenText,
        TSurveyElementTypeEnum.Date,
      ]);
      break;
    case "variable":
      checkVariableOperand(check, rightOperand.value, "text");
      break;
    case "hiddenField":
      if (!check.survey.hiddenFields.fieldIds?.includes(rightOperand.value)) {
        check.report(`Hidden field ID ${rightOperand.value} does not exist in ${where}`);
      }
      break;
    case "static": {
      const date = rightOperand.value as string;

      if (!date) {
        check.report(`Please select a date value in ${where}`);
      } else if (isNaN(new Date(date).getTime())) {
        check.report(`Invalid date format for right operand in ${where}`);
      }
      break;
    }
    default:
      break;
  }
};

const validateMatrixElementCondition = (
  element: TElementOfType<TSurveyElementTypeEnum.Matrix>,
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  const { leftOperand, operator, rightOperand } = condition;
  const { where } = check.scope;
  const meta = leftOperand.type === "element" ? leftOperand.meta : undefined;
  // ENG-6934: the id form alone is a row condition too; the write path fills the position.
  if (!isMatrixRowCondition(meta)) {
    if (rightOperand?.value !== undefined) {
      check.report(`Right operand is not allowed in matrix element in ${where}`);
    }
    if (!["isPartiallySubmitted", "isCompletelySubmitted"].includes(operator)) {
      check.report(`Operator "${operator}" is not allowed in matrix element in ${where}`);
    }
    return;
  }

  if (rightOperand === undefined) {
    check.report(`Right operand is required in matrix element in ${where}`);
    return;
  }
  if (rightOperand.type !== "static") {
    check.report(`Right operand should be a static value in matrix element in ${where}`);
  }
  // With a row id, the id decides the row (and is checked on its own); the position is
  // only the previous release's reading, rewritten from the id on every write.
  const rowIndex = Number(meta?.row);
  if (meta?.rowId === undefined && (rowIndex < 0 || rowIndex >= element.rows.length)) {
    check.report(`Invalid row index in matrix element in ${where}`);
  }
};

/** The right-operand checks that depend on the left element's type. */
const validateElementRightOperand = (
  elementInfo: { block: number; element: number; data: TSurveyElement },
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  const { operator, rightOperand } = condition;
  const element = elementInfo.data;
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      validateOpenTextElementCondition(element, condition, check);
      break;
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.PictureSelection:
    case TSurveyElementTypeEnum.Ranking:
      if (rightOperand?.type === "static") {
        validateChoiceElementOperand(
          element,
          elementInfo,
          rightOperand,
          operator,
          element.type !== TSurveyElementTypeEnum.MultipleChoiceSingle,
          check
        );
      } else {
        check.report(`Right operand should be a static value for "${operator}" in ${check.scope.where}`);
      }
      break;
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Rating:
      validateRatingElementCondition(element, condition, check);
      break;
    case TSurveyElementTypeEnum.Date:
      validateDateElementCondition(condition, check);
      break;
    case TSurveyElementTypeEnum.Matrix:
      validateMatrixElementCondition(element, condition, check);
      break;
    default:
      break;
  }
};

const validateElementCondition = (
  elementId: string,
  blockIndex: number,
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  const { operator, rightOperand } = condition;
  const { scope } = check;
  const elementInfo = check.allElements.get(elementId);

  if (!elementInfo) {
    check.report(`Element Id ${elementId} does not exist in ${scope.where}`);
    return;
  }
  if (scope.checkLaterBlock && blockIndex < elementInfo.block) {
    check.report(
      `Block ${String(blockIndex + 1)} cannot refer to an element in block ${String(elementInfo.block + 1)} that appears later in the survey`
    );
    return;
  }

  const element = elementInfo.data;

  // Validate operator based on element type
  if (isInvalidOperatorsForElementType(element, operator)) {
    check.report(`Invalid operator "${operator}" for element type "${element.type}" in ${scope.where}`);
  }

  // Validate CTA elements: CTAs without external buttons cannot be used in logic
  if (element.type === TSurveyElementTypeEnum.CTA && !element.buttonExternal) {
    check.report(
      `CTA element "${elementId}" does not have an external button and cannot be used in logic conditions in ${scope.where}`
    );
    return;
  }

  // Validate right operand
  if (ELEMENT_OPERATORS_WITHOUT_RIGHT_OPERAND.includes(operator)) {
    if (rightOperand !== undefined) {
      check.report(`Right operand should not be defined for operator "${operator}" in ${scope.where}`);
    }
    return;
  }

  validateElementRightOperand(elementInfo, condition, check);
};

const validateVariableCondition = (
  variableId: string,
  condition: TSingleCondition,
  check: TConditionCheck
): void => {
  if (!findLogicComputedField(check.survey, variableId)) {
    check.report(`Variable ID ${variableId} does not exist in ${check.scope.where}`);
    return;
  }

  if (condition.rightOperand?.type === "variable") {
    const rightVariableId = condition.rightOperand.value;
    if (!findLogicComputedField(check.survey, rightVariableId)) {
      check.report(`Variable ID ${rightVariableId} does not exist in ${check.scope.where}`);
    }
  }
};

/**
 * The operand and operator checks of one condition group — the element exists, the operator suits
 * its type, the right operand fits — shared by block logic and show-if.
 */
const validateConditionGroupOperands = (
  survey: TSurvey,
  blockIndex: number,
  conditions: TConditionGroup,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>,
  scope: TConditionScope
): z.core.$ZodIssue[] => {
  const issues: z.core.$ZodIssue[] = [];
  const check: TConditionCheck = {
    survey,
    allElements,
    scope,
    report: (message) => {
      issues.push({ code: "custom", message: `Conditional Logic: ${message}`, path: scope.path });
    },
  };

  const validateSingleCondition = (condition: TSingleCondition): void => {
    const { leftOperand } = condition;

    // Validate left operand
    if (leftOperand.type === "element") {
      validateElementCondition(leftOperand.value, blockIndex, condition, check);
    } else if (leftOperand.type === "variable") {
      validateVariableCondition(leftOperand.value, condition, check);
    } else if (leftOperand.type === "reserved") {
      // A reserved operand names a `RESERVED_FIELD_CATALOG` entry, not anything stored on the survey,
      // so there is nothing to look up and nothing to report — and that is deliberate, not an
      // omission (ENG-2538). `ZDynamicReservedField` validates the name as non-empty only, precisely
      // so a survey saved against a newer catalog still parses on an older self-hosted deployment;
      // checking it against the catalog here would reintroduce exactly the failure that schema
      // avoids, for the whole survey rather than one condition. An operand naming an entry that does
      // not exist resolves as unset, the same outcome a stale variable or hidden-field operand
      // already has.
      //
      // The arm exists because the chain below used to end in a bare `else` commented
      // `leftOperand.type === "hiddenField"`, which was true until ENG-1840 added this fourth type.
      // A reserved operand fell into it, was looked up in `survey.hiddenFields.fieldIds` and reported
      // missing — so picking any of the 16 reserved fields the picker offers made the survey
      // unsaveable, and the "usable in logic" half of ENG-1840 did not work at all.
      //
      // No operator validation here, deliberately: the `hiddenField` arm's allowlist is string-only,
      // so reusing it would reject `isGreaterThan` on `durationSeconds` — a comparison the picker
      // legitimately offers. Operators for reserved operands stay unchecked until they can be judged
      // against the entry's own dataType, which must also tolerate an entry an older self-hosted
      // catalog does not know. An unknown operator evaluates to `false`, so nothing misbehaves.
      // Checked rather than a bare `else`: this comes from persisted JSON parsed by a lenient
      // schema, so a row from a different catalog version can carry a `type` outside the union.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
    } else if (leftOperand.type === "hiddenField") {
      const fieldId = leftOperand.value;
      const field = survey.hiddenFields.fieldIds?.find((id) => id === fieldId);

      if (!field) {
        issues.push({
          code: "custom",
          message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in ${scope.where}`,
          path: scope.path,
        });
      }
    } else {
      // Spelled out rather than left as the `hiddenField` fallthrough so a fifth operand type is a
      // compile error here instead of being silently validated as a hidden field, which is how the
      // fourth one got through review.
      assertNoUnhandledLeftOperand(leftOperand);
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
  // ENG-6934: a row or column id the matrix doesn't have, at the exact path of the id.
  const findMatrix: TFindMatrix = (elementId) => {
    const element = allElements.get(elementId)?.data;
    return element?.type === TSurveyElementTypeEnum.Matrix ? element : undefined;
  };
  for (const issue of findUnknownMatrixIds(conditions, findMatrix, scope.path)) {
    issues.push({ code: "custom", message: `${issue.message} in ${scope.where}`, path: issue.path });
  }
  return issues;
};

const validateBlockConditions = (
  survey: TSurvey,
  blockIndex: number,
  logicIndex: number,
  conditions: TConditionGroup,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.core.$ZodIssue[] =>
  validateConditionGroupOperands(survey, blockIndex, conditions, allElements, {
    path: ["blocks", blockIndex, "logic", logicIndex, "conditions"],
    where: `logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
    checkLaterBlock: true,
  });

type TElementPositions = Map<string, { block: number; element: number; data: TSurveyElement }>;

/**
 * Show-if (ENG-6931). The operand checks of block logic, plus the reference rule (json-shapes §1),
 * reported at the exact path of the offending condition:
 *
 * - a block's show-if may use earlier blocks only;
 * - an element's show-if may use earlier blocks plus elements above it in the same block;
 * - nothing may use itself or anything below it, which also makes loops impossible.
 *
 * Both sides of a condition are checked: an element can be the right operand too.
 */
const validateShowIf = (
  survey: TSurvey,
  blockIndex: number,
  block: TSurveyBlock,
  allElements: TElementPositions
): z.core.$ZodIssue[] => {
  const issues: z.core.$ZodIssue[] = [];
  const blockLabel = `block ${String(blockIndex + 1)}`;

  const checkReferences = (
    group: TConditionGroup,
    groupPath: (string | number)[],
    canUse: (target: { block: number; element: number }) => boolean,
    owner: string,
    ownerElementId?: string
  ): void => {
    group.conditions.forEach((condition, conditionIndex) => {
      const conditionPath = [...groupPath, "conditions", conditionIndex];
      if (isConditionGroup(condition)) {
        checkReferences(condition, conditionPath, canUse, owner, ownerElementId);
        return;
      }
      const operands = [condition.leftOperand, condition.rightOperand];
      for (const operand of operands) {
        if (operand?.type !== "element") continue;
        const target = allElements.get(operand.value);
        // An element that doesn't exist is reported by the operand checks.
        if (!target || canUse(target)) continue;
        issues.push({
          code: "custom",
          message:
            operand.value === ownerElementId
              ? `Show-if: The show-if of ${owner} cannot use the question itself`
              : `Show-if: The show-if of ${owner} cannot use question "${operand.value}", which is not above it. A block's show-if can use earlier blocks only; a question's show-if can use earlier blocks and questions above it on the same page`,
          path: conditionPath,
        });
        // One issue per condition is enough to point at it.
        break;
      }
    });
  };

  if (block.showIf) {
    const path = ["blocks", blockIndex, "showIf"];
    issues.push(
      ...validateConditionGroupOperands(survey, blockIndex, block.showIf, allElements, {
        path,
        where: `the show-if of ${blockLabel}`,
        checkLaterBlock: false,
      })
    );
    checkReferences(block.showIf, path, (target) => target.block < blockIndex, blockLabel);
  }

  block.elements.forEach((element, elementIndex) => {
    if (!element.showIf) return;
    const path = ["blocks", blockIndex, "elements", elementIndex, "showIf"];
    const owner = `question ${String(elementIndex + 1)} of ${blockLabel}`;
    issues.push(
      ...validateConditionGroupOperands(survey, blockIndex, element.showIf, allElements, {
        path,
        where: `the show-if of ${owner}`,
        checkLaterBlock: false,
      })
    );
    checkReferences(
      element.showIf,
      path,
      (target) => target.block < blockIndex || (target.block === blockIndex && target.element < elementIndex),
      owner,
      element.id
    );
  });

  // Option show-if (ENG-6937): an option, a matrix row or a matrix column follows its element's rule.
  block.elements.forEach((element, elementIndex) => {
    for (const { listKey, items } of getOptionLists(element)) {
      items.forEach((item, itemIndex) => {
        if (!item.showIf) return;
        const path = ["blocks", blockIndex, "elements", elementIndex, listKey, itemIndex, "showIf"];
        const owner = `${OPTION_LIST_NAMES[listKey].noun} ${String(itemIndex + 1)} of question ${String(elementIndex + 1)} of ${blockLabel}`;
        issues.push(
          ...validateConditionGroupOperands(survey, blockIndex, item.showIf, allElements, {
            path,
            where: `the show-if of ${owner}`,
            checkLaterBlock: false,
          })
        );
        checkReferences(
          item.showIf,
          path,
          (target) =>
            target.block < blockIndex || (target.block === blockIndex && target.element < elementIndex),
          owner,
          element.id
        );
      });
    }
  });

  return issues;
};

/** How a logic error names a block: its editable title, or its position when the title is blank. */
const getBlockLabel = (block: TSurveyBlock, blockIndex: number): string =>
  block.name.trim() || `Block ${String(blockIndex + 1)}`;

/** Where a block rule's action sits, for its checks and their messages. */
interface TBlockActionContext {
  survey: TSurvey;
  blockIndex: number;
  logicIndex: number;
  currentBlock: TSurveyBlock;
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>;
}

/** The answers a one-step calculation may take, by the type of the field it sets. */
const TEXT_CALCULATION_ELEMENT_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.Date,
]);
const NUMBER_CALCULATION_ELEMENT_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
]);

/** The answer a one-step calculation reads, checked against the type of the field it sets. */
const validateCalculationElementSource = (
  ctx: TBlockActionContext,
  variableType: "number" | "text",
  elementId: string
): z.core.$ZodIssue | undefined => {
  const { blockIndex, logicIndex, allElements } = ctx;
  const selectedElement = allElements.get(elementId);

  if (variableType === "text") {
    if (selectedElement && TEXT_CALCULATION_ELEMENT_TYPES.has(selectedElement.data.type)) return undefined;
    return {
      code: "custom",
      message: `Conditional Logic: Invalid element type for text variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }

  if (
    !selectedElement ||
    (!NUMBER_CALCULATION_ELEMENT_TYPES.has(selectedElement.data.type) &&
      selectedElement.data.type === TSurveyElementTypeEnum.OpenText &&
      selectedElement.data.inputType !== "number")
  ) {
    return {
      code: "custom",
      message: `Conditional Logic: Invalid element type for number variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }
  return undefined;
};

/**
 * Set value on a true/false field (ENG-6973): one-step `assign` only, of a static `true` / `false` or
 * a reference to another true/false Embedded Data field. No expression: expressions don't return
 * true/false yet.
 */
const validateBooleanCalculateAction = (
  ctx: TBlockActionContext,
  action: Extract<TSurveyBlockLogicAction, { objective: "calculate" }>,
  actionIndex: number
): z.core.$ZodIssue | undefined => {
  const { survey, blockIndex, logicIndex } = ctx;
  const getFieldType = (storageKey: string, source: "computed" | "ingested") =>
    source === "computed"
      ? findLogicComputedField(survey, storageKey)?.dataType
      : survey.embeddedFields?.find(
          ({ field, link }) => field.source === "ingested" && link.storageKey === storageKey
        )?.field.dataType;

  if (isValidBooleanAssign(action, getFieldType)) return undefined;

  return {
    code: "custom",
    message: `Conditional Logic: ${BOOLEAN_ASSIGN_MESSAGE} in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
    path: ["blocks", blockIndex, "logic", logicIndex, "actions", actionIndex, "value"],
  };
};

/**
 * A Set value or one-step calculation. Its expression's issues, each at its exact path into the tree,
 * go to `expressionIssues`; anything else is returned.
 */
const validateBlockCalculateAction = (
  ctx: TBlockActionContext,
  action: Extract<TSurveyBlockLogicAction, { objective: "calculate" }>,
  actionIndex: number,
  expressionIssues: z.core.$ZodIssue[]
): z.core.$ZodIssue | undefined => {
  const { survey, blockIndex, logicIndex, allElements } = ctx;
  const variable = findLogicComputedField(survey, action.variableId);

  if (!variable) {
    return {
      code: "custom",
      message: `Conditional Logic: Variable ID ${action.variableId} does not exist in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }

  // ENG-6973: a true/false field is set in one step only, to True, False or another true/false field.
  if (variable.type === "boolean") {
    return validateBooleanCalculateAction(ctx, action, actionIndex);
  }

  // True and False are values of a true/false field only.
  if (isStaticBooleanValue(action.value)) {
    return {
      code: "custom",
      message: `Conditional Logic: ${BOOLEAN_VALUE_TARGET_MESSAGE} in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex, "actions", actionIndex, "value"],
    };
  }

  // Set value (ENG-6935): the expression's types and its result against the field, each issue at
  // its exact path into the tree.
  if (action.value.type === "expression") {
    const valuePath = ["blocks", blockIndex, "logic", logicIndex, "actions", actionIndex, "value", "value"];
    for (const issue of getSetValueExpressionIssues(
      action.value.value,
      variable.dataType,
      getExpressionTypeContext(survey, allElements)
    )) {
      expressionIssues.push({ code: "custom", message: issue.message, path: [...valuePath, ...issue.path] });
    }
    return undefined;
  }

  // The one-step operators predate dates; a computed date is set with a formula.
  if (variable.type === "date") {
    return {
      code: "custom",
      message: `Conditional Logic: A date field is set with an expression in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex, "actions", actionIndex, "value"],
    };
  }

  if (action.value.type === "variable") {
    const selectedVariable = findLogicComputedField(survey, action.value.value);

    if (selectedVariable?.type !== variable.type) {
      return {
        code: "custom",
        message: `Conditional Logic: Invalid variable type for variable in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
        path: ["blocks", blockIndex, "logic", logicIndex],
      };
    }
  }

  if (action.value.type === "element") {
    return validateCalculationElementSource(ctx, variable.type, action.value.value);
  }
  return undefined;
};

/** Require answer must target an optional question in a later block. */
const validateBlockRequireAnswerAction = (
  ctx: TBlockActionContext,
  targetElementId: string
): z.core.$ZodIssue | undefined => {
  const { blockIndex, logicIndex, allElements } = ctx;
  const targetElementInfo = allElements.get(targetElementId);

  if (!targetElementInfo) {
    return {
      code: "custom",
      message: `Conditional Logic: Element ID ${targetElementId} does not exist for requireAnswer action in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }

  // Check if element is in the current block (not allowed)
  if (targetElementInfo.block === blockIndex) {
    return {
      code: "custom",
      message: `Conditional Logic: Element ${targetElementId} cannot be in the current block for requireAnswer action in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}. RequireAnswer must target elements in other blocks.`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }

  // Check if element is in a previous block (should target future blocks)
  if (targetElementInfo.block < blockIndex) {
    return {
      code: "custom",
      message: `Conditional Logic: Element ${targetElementId} is in a previous block (block ${String(targetElementInfo.block + 1)}). RequireAnswer should target elements in future blocks after block ${String(blockIndex + 1)}.`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }

  // Check if element is optional (not required)
  if (targetElementInfo.data.required) {
    return {
      code: "custom",
      message: `Conditional Logic: Element ${targetElementId} in block ${String(targetElementInfo.block + 1)} is already required in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }
  return undefined;
};

/** A jump must go to a block or an ending that exists, and not to its own block. */
const validateBlockJumpAction = (
  ctx: TBlockActionContext,
  targetBlockId: string
): z.core.$ZodIssue | undefined => {
  const { survey, blockIndex, logicIndex, currentBlock } = ctx;
  const possibleTargets = [...survey.blocks.map((b) => b.id), ...survey.endings.map((ending) => ending.id)];

  if (!possibleTargets.includes(targetBlockId)) {
    // Named by the owning block's title, never the missing target's id: the id is internal and
    // the block it pointed at no longer exists to be named.
    return {
      code: "custom",
      message: `Conditional Logic: Jump destination in rule ${String(logicIndex + 1)} of "${getBlockLabel(currentBlock, blockIndex)}" no longer exists. Choose a valid destination.`,
      path: ["blocks", blockIndex, "logic", logicIndex],
      params: { missingLogicDestination: "jump" },
    };
  }

  // Cannot jump to the current block
  if (targetBlockId === currentBlock.id) {
    return {
      code: "custom",
      message: `Conditional Logic: Cannot jump to the current block in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic", logicIndex],
    };
  }
  return undefined;
};

const validateBlockActions = (
  survey: TSurvey,
  blockIndex: number,
  logicIndex: number,
  actions: TSurveyBlockLogicAction[],
  currentBlock: TSurveyBlock,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.core.$ZodIssue[] => {
  const ctx: TBlockActionContext = { survey, blockIndex, logicIndex, currentBlock, allElements };
  const expressionIssues: z.core.$ZodIssue[] = [];

  const actionIssues: (z.core.$ZodIssue | undefined)[] = actions.map((action, actionIndex) => {
    switch (action.objective) {
      case "calculate":
        return validateBlockCalculateAction(ctx, action, actionIndex, expressionIssues);
      case "requireAnswer":
        return validateBlockRequireAnswerAction(ctx, action.target);
      case "jumpToBlock":
        return validateBlockJumpAction(ctx, action.target);
      default:
        // `markLowQuality` (ENG-6933) has nothing to check: it takes no target.
        return undefined;
    }
  });

  const jumpToBlockActions = actions.filter((action) => action.objective === "jumpToBlock");
  if (jumpToBlockActions.length > 1) {
    actionIssues.push({
      code: "custom",
      message: `Conditional Logic: Multiple jump actions are not allowed in logic no: ${String(logicIndex + 1)} of block ${String(blockIndex + 1)}`,
      path: ["blocks", blockIndex, "logic"],
    });
  }

  const filteredActionIssues = actionIssues.filter((issue): issue is z.core.$ZodIssue => issue !== undefined);
  return [...filteredActionIssues, ...expressionIssues];
};

/**
 * The computed field a logic reference names, with its type. Read from the rows when the payload has
 * them, because a computed date (ENG-6935) or true/false (ENG-6973) lives only there; the legacy
 * `variables` otherwise.
 */
const findLogicComputedField = (
  survey: TSurvey,
  storageKey: string
): { type: "number" | "text" | "date" | "boolean"; dataType: TEmbeddedDataType } | undefined => {
  const row = survey.embeddedFields?.find(
    ({ field, link }) => field.source === "computed" && link.storageKey === storageKey
  );
  if (row) {
    const { dataType } = row.field;
    return { type: dataType === "string" ? "text" : dataType, dataType };
  }
  const variable = survey.variables.find((v) => v.id === storageKey);
  if (!variable) return undefined;
  return { type: variable.type, dataType: variable.type === "number" ? "number" : "string" };
};

/** What the expression type check resolves references against: this survey's elements and fields. */
const getExpressionTypeContext = (
  survey: TSurvey,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): TExpressionTypeContext => ({
  getElement: (elementId) => {
    const element = allElements.get(elementId)?.data;
    if (!element) return undefined;
    return { type: element.type, inputType: "inputType" in element ? element.inputType : undefined };
  },
  getComputedFieldType: (storageKey) => findLogicComputedField(survey, storageKey)?.dataType,
  getIngestedFieldType: (storageKey) => {
    if (survey.embeddedFields !== undefined) {
      return survey.embeddedFields.find(
        ({ field, link }) => field.source === "ingested" && link.storageKey === storageKey
      )?.field.dataType;
    }
    return survey.hiddenFields.fieldIds?.includes(storageKey) ? "string" : undefined;
  },
  getReservedFieldType: (name) => RESERVED_FIELD_CATALOG.find((entry) => entry.name === name)?.dataType,
});

const validateBlockLogicFallback = (
  survey: TSurvey,
  blockIndex: number,
  block: TSurveyBlock
): z.core.$ZodIssue[] | undefined => {
  if (!block.logicFallback) return;

  if (!block.logic?.length && block.logicFallback) {
    return [
      {
        code: "custom",
        message: `Conditional Logic: Fallback logic is defined without any logic in block ${String(blockIndex + 1)}`,
        path: ["blocks", blockIndex],
      },
    ];
  } else if (block.id === block.logicFallback) {
    return [
      {
        code: "custom",
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

  survey.endings.forEach((e: TSurveyEnding) => {
    possibleFallbackIds.push(e.id);
  });

  if (!possibleFallbackIds.includes(block.logicFallback)) {
    return [
      {
        code: "custom",
        message: `Conditional Logic: Fallback destination of "${getBlockLabel(block, blockIndex)}" no longer exists. Choose a valid destination.`,
        path: ["blocks", blockIndex],
        params: { missingLogicDestination: "fallback" },
      },
    ];
  }
};

const validateBlockLogic = (
  survey: TSurvey,
  blockIndex: number,
  block: TSurveyBlock,
  allElements: Map<string, { block: number; element: number; data: TSurveyElement }>
): z.core.$ZodIssue[] => {
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

// ZSurvey is refined, so update/create inputs start from ZSurveyBase and reapply the same refinement.
export const ZSurveyUpdateInput = ZSurveyBase.omit({
  createdAt: true,
  updatedAt: true,
  followUps: true,
  // ENG-2949: stripped. This is the legacy v1 PUT boundary, which ignores a
  // `customCss` key like any other unknown one; omitting it here means the merged round-trip never hands
  // the stored value to `updateSurvey`, which then leaves the survey's CSS untouched.
  customCss: true,
  // The ENG-3282 authorization facts (`visibility`, `ownerId`, the versions) are deliberately NOT
  // omitted: the v1 PUT round-trip re-parses the loaded survey, which carries them.
  // `updateSurveyInternal` strips them before the write instead, so none is writable through here.
})
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
      .prefault([]),
  })
  .and(
    z.object({
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
  )
  .superRefine(surveyRefinement)
  // `embeddedFields` is read by the refinement and never output. This schema is the v1
  // `PUT /api/v1/management/surveys/{id}` boundary, which re-parses the loaded survey merged with the
  // caller's patch. Output, the key would hand `updateSurvey` a desired set on every legacy PUT, turning
  // what the legacy columns say into a no-op, so the PUT stays a legacy write. Read, it is what logic
  // resolves against that the legacy columns can't say (a computed date, ENG-6935): the route sets it
  // to the rows the write will leave the survey with (`getLegacyWriteEmbeddedFields`), over whatever
  // the caller sent.
  .transform(({ embeddedFields: _validatedOnly, ...survey }) => survey);

// Helper function to make all properties of a Zod object schema optional
const makeSchemaOptional = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{
  [K in keyof T]: z.ZodOptional<T[K]>;
}> => {
  return schema.partial();
};

export const ZSurveyCreateInput = makeSchemaOptional(ZSurveyBase)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    workspaceOverwrites: true,
    languages: true,
    followUps: true,
    // archivedAt is owned exclusively by the archive/restore flows; a create must never set it,
    // otherwise a caller could POST an already-archived, purge-eligible survey.
    archivedAt: true,
    // Server-owned authorization facts (ENG-3282): never writable through a survey payload.
    visibility: true,
    ownerId: true,
    visibilityVersion: true,
    visibilityProjectedVersion: true,
    visibilityChangedAt: true,
    visibilityChangedById: true,
    // ENG-2949: custom CSS is stripped from generic create payloads. Only callers that ran the shared
    // custom CSS save service may set it, through `createSurvey`'s options.
    customCss: true,
  })
  .extend({
    name: z.string(), // Keep name required
    questions: ZSurveyBase.shape.questions,
    blocks: ZSurveyBase.shape.blocks,
    languages: z.array(ZSurveyLanguage).prefault([]),
    welcomeCard: ZSurveyWelcomeCard.prefault({
      enabled: false,
    }),
    endings: ZSurveyEndings.prefault([]),
    type: ZSurveyType.prefault("link"),
    followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).prefault([]),
    isAutoProgressingEnabled: z.boolean().prefault(false),
  })
  .superRefine((survey, ctx) => {
    surveyRefinement(survey as z.infer<typeof ZSurveyBase>, ctx);
  })
  .superRefine((data, ctx) => {
    const hasQuestions = data.questions.length > 0;
    const hasBlocks = data.blocks.length > 0;

    if (hasQuestions && hasBlocks) {
      ctx.addIssue({
        code: "custom",
        message: "Cannot provide both questions and blocks. Please provide only one of these fields.",
        path: ["questions"],
      });
    }

    if (!hasQuestions && !hasBlocks) {
      ctx.addIssue({
        code: "custom",
        message: "Must provide either questions or blocks. Both cannot be empty.",
        path: ["questions"],
      });
    }
  });

export type TSurvey = z.infer<typeof ZSurvey>;

export const ZSurveyCreateInputWithWorkspaceId = makeSchemaOptional(ZSurveyBase)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    workspaceOverwrites: true,
    languages: true,
    followUps: true,
    // archivedAt is owned exclusively by the archive/restore flows; a create must never set it,
    // otherwise a caller could POST an already-archived, purge-eligible survey.
    archivedAt: true,
    // Server-owned authorization facts (ENG-3282): never writable through a survey payload.
    visibility: true,
    ownerId: true,
    visibilityVersion: true,
    visibilityProjectedVersion: true,
    visibilityChangedAt: true,
    visibilityChangedById: true,
    // ENG-2949: custom CSS is stripped from generic create payloads. Only callers that ran the shared
    // custom CSS save service may set it, through `createSurvey`'s options.
    customCss: true,
  })
  .extend({
    name: z.string(), // Keep name required
    workspaceId: z.string(),
    questions: ZSurveyBase.shape.questions,
    blocks: ZSurveyBase.shape.blocks,
    languages: z.array(ZSurveyLanguage).prefault([]),
    welcomeCard: ZSurveyWelcomeCard.prefault({
      enabled: false,
    }),
    endings: ZSurveyEndings.prefault([]),
    type: ZSurveyType.prefault("link"),
    followUps: z.array(ZSurveyFollowUp.omit({ createdAt: true, updatedAt: true })).prefault([]),
    isAutoProgressingEnabled: z.boolean().prefault(false),
  })
  .superRefine((survey, ctx) => {
    surveyRefinement(survey as z.infer<typeof ZSurveyBase>, ctx);
  })
  .superRefine((data, ctx) => {
    const hasQuestions = data.questions.length > 0;
    const hasBlocks = data.blocks.length > 0;

    if (hasQuestions && hasBlocks) {
      ctx.addIssue({
        code: "custom",
        message: "Cannot provide both questions and blocks. Please provide only one of these fields.",
        path: ["questions"],
      });
    }

    if (!hasQuestions && !hasBlocks) {
      ctx.addIssue({
        code: "custom",
        message: "Must provide either questions or blocks. Both cannot be empty.",
        path: ["questions"],
      });
    }
  });

export type TSurveyCreateInputWithWorkspaceId = z.infer<typeof ZSurveyCreateInputWithWorkspaceId>;
export interface TSurveyDates {
  createdAt: TSurvey["createdAt"];
  updatedAt: TSurvey["updatedAt"];
}

export type TSurveyCreateInput = z.input<typeof ZSurveyCreateInput>;

export type TSurveyEditorTabs = "elements" | "flow" | "styling" | "language" | "settings" | "followUps";

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

/**
 * Option bases (ENG-6937). `shownCount`: how many of the respondents in the element's base were shown
 * the option (or matrix row), set only when that is fewer than all of them; percentages are over it.
 * `hidden`: the option is Hidden (retired on a live survey) and stays in results labelled so.
 */
const ZSummaryOptionBase = {
  shownCount: z.number().optional(),
  hidden: z.literal(true).optional(),
};

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
      ...ZSummaryOptionBase,
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
      imageUrl: ZStorageUrl,
      count: z.number(),
      percentage: z.number(),
      ...ZSummaryOptionBase,
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

export const ZSurveyElementSummaryCsat = z.object({
  type: z.literal(TSurveyElementTypeEnum.CSAT),
  element: ZSurveyCsatElement,
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

export type TSurveyElementSummaryCsat = z.infer<typeof ZSurveyElementSummaryCsat>;

export const ZSurveyElementSummaryCes = z.object({
  type: z.literal(TSurveyElementTypeEnum.CES),
  element: ZSurveyCesElement,
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

export type TSurveyElementSummaryCes = z.infer<typeof ZSurveyElementSummaryCes>;

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

export const ZSurveyElementSummarySignature = z.object({
  type: z.literal(TSurveyElementTypeEnum.Signature),
  element: ZSurveySignatureElement,
  responseCount: z.number(),
  signedCount: z.number(),
  skippedCount: z.number(),
  signatures: z.array(
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

export type TSurveyElementSummarySignature = z.infer<typeof ZSurveyElementSummarySignature>;

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
      ...ZSummaryOptionBase,
    })
  ),
});

export type TSurveyElementSummaryMatrix = z.infer<typeof ZSurveyElementSummaryMatrix>;

export const ZSurveyElementSummaryHiddenFields = z.object({
  type: z.literal("hiddenField"),
  /** The storage key the samples were read from. Unique per survey; not shown. */
  id: z.string(),
  /** What the card is titled: the field's name, disambiguated on collision (ENG-3233). */
  label: z.string(),
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
      ...ZSummaryOptionBase,
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
  ZSurveyElementSummarySignature,
  ZSurveyElementSummaryCal,
  ZSurveyElementSummaryMatrix,
  ZSurveyElementSummaryAddress,
  ZSurveyElementSummaryRanking,
  ZSurveyElementSummaryContactInfo,
  ZSurveyElementSummaryCsat,
  ZSurveyElementSummaryCes,
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
      elementId: z.cuid2(),
      elementType: z.enum(TSurveyElementTypeEnum),
      headline: z.string(),
      ttc: z.number(),
      impressions: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number(),
      /** Respondents the element was not shown to, from their not-shown records (ENG-6936). */
      notShownCount: z.number(),
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
  // When true, include archived surveys (archivedAt not null) in results.
  // When false/undefined, archived surveys are excluded (hidden by default).
  includeArchived: z.boolean().optional(),
  // true keeps only single-use surveys (`singleUse.enabled`), false only the others; undefined keeps both.
  singleUse: z.boolean().optional(),
  // true keeps only surveys with a PIN, false only the others; undefined keeps both.
  pinProtected: z.boolean().optional(),
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

export const ZSortOption = z.object({
  label: z.string(),
  value: z.enum(["createdAt", "updatedAt", "name", "relevance"]),
});

export type TSortOption = z.infer<typeof ZSortOption>;

export const ZSurveyRecallItem = z.object({
  id: z.string(),
  label: z.string(),
  // "reserved" (ENG-1840) addresses a RESERVED_FIELD_CATALOG entry by name rather than a stored id.
  type: z.enum(["element", "hiddenField", "attributeClass", "variable", "reserved"]),
});

export type TSurveyRecallItem = z.infer<typeof ZSurveyRecallItem>;
