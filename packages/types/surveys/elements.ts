import { z } from "zod";
import { ZUrl } from "../common";
import { ZI18nString } from "../i18n";
import { ZAllowedFileExtension } from "../storage";
import { FORBIDDEN_IDS } from "./validation";

// Element Type Enum (same as question types)
export enum TSurveyElementTypeEnum {
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

// Element ID validation (same rules as questions - USER EDITABLE)
export const ZSurveyElementId = z.string().superRefine((id, ctx) => {
  if (FORBIDDEN_IDS.includes(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Element id is not allowed`,
    });
  }

  if (id.includes(" ")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Element id not allowed, avoid using spaces.",
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Element id not allowed, use only alphanumeric characters, hyphens, or underscores.",
    });
  }
});

export type TSurveyElementId = z.infer<typeof ZSurveyElementId>;

// Base element (like ZSurveyQuestionBase but WITHOUT logic, buttonLabel, backButtonLabel)
export const ZSurveyElementBase = z.object({
  id: ZSurveyElementId,
  type: z.nativeEnum(TSurveyElementTypeEnum),
  headline: ZI18nString,
  subheader: ZI18nString.optional(),
  imageUrl: ZUrl.optional(),
  videoUrl: ZUrl.optional(),
  required: z.boolean(),
  scale: z.enum(["number", "smiley", "star"]).optional(),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]).optional(),
  isDraft: z.boolean().optional(),
});

// OpenText Element
export const ZSurveyOpenTextElementInputType = z.enum(["text", "email", "url", "number", "phone"]);
export type TSurveyOpenTextElementInputType = z.infer<typeof ZSurveyOpenTextElementInputType>;

export const ZSurveyOpenTextElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.OpenText),
  placeholder: ZI18nString.optional(),
  longAnswer: z.boolean().optional(),
  inputType: ZSurveyOpenTextElementInputType.optional().default("text"),
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

export type TSurveyOpenTextElement = z.infer<typeof ZSurveyOpenTextElement>;

// Consent Element
export const ZSurveyConsentElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Consent),
  label: ZI18nString,
});

export type TSurveyConsentElement = z.infer<typeof ZSurveyConsentElement>;

// Multiple Choice Elements
export const ZSurveyElementChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export type TSurveyElementChoice = z.infer<typeof ZSurveyElementChoice>;

export const ZShuffleOption = z.enum(["none", "all", "exceptLast"]);
export type TShuffleOption = z.infer<typeof ZShuffleOption>;

export const ZSurveyMultipleChoiceElement = ZSurveyElementBase.extend({
  type: z.union([
    z.literal(TSurveyElementTypeEnum.MultipleChoiceSingle),
    z.literal(TSurveyElementTypeEnum.MultipleChoiceMulti),
  ]),
  choices: z
    .array(ZSurveyElementChoice)
    .min(2, { message: "Multiple Choice Element must have at least two choices" }),
  shuffleOption: ZShuffleOption.optional(),
  otherOptionPlaceholder: ZI18nString.optional(),
});

export type TSurveyMultipleChoiceElement = z.infer<typeof ZSurveyMultipleChoiceElement>;

// NPS Element
export const ZSurveyNPSElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.NPS),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
});

export type TSurveyNPSElement = z.infer<typeof ZSurveyNPSElement>;

// CTA Element
export const ZSurveyCTAElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.CTA),
  buttonExternal: z.boolean().optional().default(false),
  buttonUrl: z.string().optional(),
  ctaButtonLabel: ZI18nString.optional(),
}).superRefine((data, ctx) => {
  // When buttonExternal is true, buttonUrl is required and must be valid
  if (data.buttonExternal) {
    if (!data.buttonUrl || data.buttonUrl.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Button URL is required when external button is enabled",
        path: ["buttonUrl"],
      });
    } else {
      // Validate URL format only when buttonExternal is true and URL is provided
      const urlValidation = ZUrl.safeParse(data.buttonUrl);
      if (!urlValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid URL",
          path: ["buttonUrl"],
        });
      }
    }
  }
});

export type TSurveyCTAElement = z.infer<typeof ZSurveyCTAElement>;

// Rating Element
export const ZSurveyRatingElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Rating),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(6), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false),
});

export type TSurveyRatingElement = z.infer<typeof ZSurveyRatingElement>;

// Picture Selection Element
export const ZSurveyPictureChoice = z.object({
  id: z.string(),
  imageUrl: z.string(),
});

export type TSurveyPictureChoice = z.infer<typeof ZSurveyPictureChoice>;

export const ZSurveyPictureSelectionElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.PictureSelection),
  allowMulti: z.boolean().optional().default(false),
  choices: z
    .array(ZSurveyPictureChoice)
    .min(2, { message: "Picture Selection element must have a minimum of 2 choices" }),
});

export type TSurveyPictureSelectionElement = z.infer<typeof ZSurveyPictureSelectionElement>;

// Date Element
export const ZSurveyDateElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Date),
  html: ZI18nString.optional(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"]),
});

export type TSurveyDateElement = z.infer<typeof ZSurveyDateElement>;

// File Upload Element
export const ZSurveyFileUploadElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.FileUpload),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional(),
});

export type TSurveyFileUploadElement = z.infer<typeof ZSurveyFileUploadElement>;

// Cal Element
export const ZSurveyCalElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Cal),
  calUserName: z.string().min(1, { message: "Cal user name is required" }),
  calHost: z.string().optional(),
});

export type TSurveyCalElement = z.infer<typeof ZSurveyCalElement>;

// Matrix Element
export const ZSurveyMatrixElementChoice = z.object({
  id: z.string(),
  label: ZI18nString,
});

export type TSurveyMatrixElementChoice = z.infer<typeof ZSurveyMatrixElementChoice>;

export const ZSurveyMatrixElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Matrix),
  rows: z.array(ZSurveyMatrixElementChoice),
  columns: z.array(ZSurveyMatrixElementChoice),
  shuffleOption: ZShuffleOption.optional().default("none"),
});

export type TSurveyMatrixElement = z.infer<typeof ZSurveyMatrixElement>;

// Address Element
const ZToggleInputConfig = z.object({
  show: z.boolean(),
  required: z.boolean(),
  placeholder: ZI18nString,
});

export type TInputFieldConfig = z.infer<typeof ZToggleInputConfig>;

export const ZSurveyAddressElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Address),
  addressLine1: ZToggleInputConfig,
  addressLine2: ZToggleInputConfig,
  city: ZToggleInputConfig,
  state: ZToggleInputConfig,
  zip: ZToggleInputConfig,
  country: ZToggleInputConfig,
});

export type TSurveyAddressElement = z.infer<typeof ZSurveyAddressElement>;

// Ranking Element
export const ZSurveyRankingElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.Ranking),
  choices: z
    .array(ZSurveyElementChoice)
    .min(2, { message: "Ranking Element must have at least two options" })
    .max(25, { message: "Ranking Element can have at most 25 options" }),
  otherOptionPlaceholder: ZI18nString.optional(),
  shuffleOption: ZShuffleOption.optional(),
});

export type TSurveyRankingElement = z.infer<typeof ZSurveyRankingElement>;

// Contact Info Element
export const ZSurveyContactInfoElement = ZSurveyElementBase.extend({
  type: z.literal(TSurveyElementTypeEnum.ContactInfo),
  firstName: ZToggleInputConfig,
  lastName: ZToggleInputConfig,
  email: ZToggleInputConfig,
  phone: ZToggleInputConfig,
  company: ZToggleInputConfig,
});

export type TSurveyContactInfoElement = z.infer<typeof ZSurveyContactInfoElement>;

// Union of all element types
export const ZSurveyElement = z.union([
  ZSurveyOpenTextElement,
  ZSurveyConsentElement,
  ZSurveyMultipleChoiceElement,
  ZSurveyNPSElement,
  ZSurveyCTAElement,
  ZSurveyRatingElement,
  ZSurveyPictureSelectionElement,
  ZSurveyDateElement,
  ZSurveyFileUploadElement,
  ZSurveyCalElement,
  ZSurveyMatrixElement,
  ZSurveyAddressElement,
  ZSurveyRankingElement,
  ZSurveyContactInfoElement,
]);

export type TSurveyElement = z.infer<typeof ZSurveyElement>;

export const ZSurveyElements = z.array(ZSurveyElement);
export type TSurveyElements = z.infer<typeof ZSurveyElements>;
