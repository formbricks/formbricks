import { z } from "zod";
import { ZI18nString } from "../i18n";

// Field types for field-specific validation (address and contact info elements)
export const ZAddressField = z.enum(["addressLine1", "addressLine2", "city", "state", "zip", "country"]);
export type TAddressField = z.infer<typeof ZAddressField>;

export const ZContactInfoField = z.enum(["firstName", "lastName", "email", "phone", "company"]);
export type TContactInfoField = z.infer<typeof ZContactInfoField>;

// Union type for all possible field types
export const ZValidationRuleField = z.union([ZAddressField, ZContactInfoField]);
export type TValidationRuleField = z.infer<typeof ZValidationRuleField>;

// Validation rule type enum - extensible for future rule types
export const ZValidationRuleType = z.enum([
  // Text/OpenText rules
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",

  // Numeric rules (for OpenText inputType=number)
  "minValue",
  "maxValue",
  "isGreaterThan",
  "isLessThan",

  // Selection rules (MultiSelect, PictureSelection)
  "minSelections",
  "maxSelections",

  // Ranking rules
  "minRanked",

  // Matrix rules
  "minRowsAnswered",

  // Date rules
  "isLaterThan",
  "isEarlierThan",
  "isBetween",
  "isNotBetween",

  // File upload rules
  "fileSizeAtLeast",
  "fileSizeAtMost",
  "fileExtensionIs",
  "fileExtensionIsNot",
]);

export type TValidationRuleType = z.infer<typeof ZValidationRuleType>;

// Rule params - union for type-safe params per rule type (type is now at rule level)
export const ZValidationRuleParamsMinLength = z.object({
  min: z.number().min(0),
});

export const ZValidationRuleParamsMaxLength = z.object({
  max: z.number().min(1),
});

export const ZValidationRuleParamsPattern = z.object({
  pattern: z.string().min(1),
  flags: z.string().optional(),
});

export const ZValidationRuleParamsEmail = z.object({});

export const ZValidationRuleParamsUrl = z.object({});

export const ZValidationRuleParamsPhone = z.object({});

export const ZValidationRuleParamsMinValue = z.object({
  min: z.number(),
});

export const ZValidationRuleParamsMaxValue = z.object({
  max: z.number(),
});

export const ZValidationRuleParamsMinSelections = z.object({
  min: z.number().min(1),
});

export const ZValidationRuleParamsMaxSelections = z.object({
  max: z.number().min(1),
});

export const ZValidationRuleParamsEquals = z.object({
  value: z.string(),
});

export const ZValidationRuleParamsDoesNotEqual = z.object({
  value: z.string(),
});

export const ZValidationRuleParamsContains = z.object({
  value: z.string(),
});

export const ZValidationRuleParamsDoesNotContain = z.object({
  value: z.string(),
});

export const ZValidationRuleParamsIsGreaterThan = z.object({
  min: z.number(),
});

export const ZValidationRuleParamsIsLessThan = z.object({
  max: z.number(),
});

export const ZValidationRuleParamsIsLaterThan = z.object({
  date: z.string(), // YYYY-MM-DD format
});

export const ZValidationRuleParamsIsEarlierThan = z.object({
  date: z.string(), // YYYY-MM-DD format
});

export const ZValidationRuleParamsIsBetween = z.object({
  startDate: z.string(), // YYYY-MM-DD format
  endDate: z.string(), // YYYY-MM-DD format
});

export const ZValidationRuleParamsIsNotBetween = z.object({
  startDate: z.string(), // YYYY-MM-DD format
  endDate: z.string(), // YYYY-MM-DD format
});

export const ZValidationRuleParamsMinRanked = z.object({
  min: z.number().min(1),
});

export const ZValidationRuleParamsMinRowsAnswered = z.object({
  min: z.number().min(1),
});

// File upload rule params
export const ZValidationRuleParamsFileSizeAtLeast = z.object({
  size: z.number().min(0),
  unit: z.enum(["KB", "MB"]),
});

export const ZValidationRuleParamsFileSizeAtMost = z.object({
  size: z.number().min(0),
  unit: z.enum(["KB", "MB"]),
});

export const ZValidationRuleParamsFileExtensionIs = z.object({
  extensions: z.array(z.string()).min(1),
});

export const ZValidationRuleParamsFileExtensionIsNot = z.object({
  extensions: z.array(z.string()).min(1),
});

// Union of all params types
export const ZValidationRuleParams = z.union([
  ZValidationRuleParamsMinLength,
  ZValidationRuleParamsMaxLength,
  ZValidationRuleParamsPattern,
  ZValidationRuleParamsEmail,
  ZValidationRuleParamsUrl,
  ZValidationRuleParamsPhone,
  ZValidationRuleParamsEquals,
  ZValidationRuleParamsDoesNotEqual,
  ZValidationRuleParamsContains,
  ZValidationRuleParamsDoesNotContain,
  ZValidationRuleParamsMinValue,
  ZValidationRuleParamsMaxValue,
  ZValidationRuleParamsIsGreaterThan,
  ZValidationRuleParamsIsLessThan,
  ZValidationRuleParamsMinSelections,
  ZValidationRuleParamsMaxSelections,
  ZValidationRuleParamsIsLaterThan,
  ZValidationRuleParamsIsEarlierThan,
  ZValidationRuleParamsIsBetween,
  ZValidationRuleParamsIsNotBetween,
  ZValidationRuleParamsMinRanked,
  ZValidationRuleParamsMinRowsAnswered,
  ZValidationRuleParamsFileSizeAtLeast,
  ZValidationRuleParamsFileSizeAtMost,
  ZValidationRuleParamsFileExtensionIs,
  ZValidationRuleParamsFileExtensionIsNot,
]);

export type TValidationRuleParams = z.infer<typeof ZValidationRuleParams>;

// Extract specific param types for validators
export type TValidationRuleParamsMinLength = z.infer<typeof ZValidationRuleParamsMinLength>;
export type TValidationRuleParamsMaxLength = z.infer<typeof ZValidationRuleParamsMaxLength>;
export type TValidationRuleParamsPattern = z.infer<typeof ZValidationRuleParamsPattern>;
export type TValidationRuleParamsEmail = z.infer<typeof ZValidationRuleParamsEmail>;
export type TValidationRuleParamsUrl = z.infer<typeof ZValidationRuleParamsUrl>;
export type TValidationRuleParamsPhone = z.infer<typeof ZValidationRuleParamsPhone>;
export type TValidationRuleParamsMinValue = z.infer<typeof ZValidationRuleParamsMinValue>;
export type TValidationRuleParamsMaxValue = z.infer<typeof ZValidationRuleParamsMaxValue>;
export type TValidationRuleParamsMinSelections = z.infer<typeof ZValidationRuleParamsMinSelections>;
export type TValidationRuleParamsMaxSelections = z.infer<typeof ZValidationRuleParamsMaxSelections>;
export type TValidationRuleParamsEquals = z.infer<typeof ZValidationRuleParamsEquals>;
export type TValidationRuleParamsDoesNotEqual = z.infer<typeof ZValidationRuleParamsDoesNotEqual>;
export type TValidationRuleParamsContains = z.infer<typeof ZValidationRuleParamsContains>;
export type TValidationRuleParamsDoesNotContain = z.infer<typeof ZValidationRuleParamsDoesNotContain>;
export type TValidationRuleParamsIsGreaterThan = z.infer<typeof ZValidationRuleParamsIsGreaterThan>;
export type TValidationRuleParamsIsLessThan = z.infer<typeof ZValidationRuleParamsIsLessThan>;
export type TValidationRuleParamsIsLaterThan = z.infer<typeof ZValidationRuleParamsIsLaterThan>;
export type TValidationRuleParamsIsEarlierThan = z.infer<typeof ZValidationRuleParamsIsEarlierThan>;
export type TValidationRuleParamsIsBetween = z.infer<typeof ZValidationRuleParamsIsBetween>;
export type TValidationRuleParamsIsNotBetween = z.infer<typeof ZValidationRuleParamsIsNotBetween>;
export type TValidationRuleParamsMinRanked = z.infer<typeof ZValidationRuleParamsMinRanked>;
export type TValidationRuleParamsMinRowsAnswered = z.infer<typeof ZValidationRuleParamsMinRowsAnswered>;
export type TValidationRuleParamsFileSizeAtLeast = z.infer<typeof ZValidationRuleParamsFileSizeAtLeast>;
export type TValidationRuleParamsFileSizeAtMost = z.infer<typeof ZValidationRuleParamsFileSizeAtMost>;
export type TValidationRuleParamsFileExtensionIs = z.infer<typeof ZValidationRuleParamsFileExtensionIs>;
export type TValidationRuleParamsFileExtensionIsNot = z.infer<typeof ZValidationRuleParamsFileExtensionIsNot>;

// Validation rule stored on element - discriminated union with type at top level
// Field property is optional and used for address/contact info elements to target specific sub-fields
export const ZValidationRule = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("minLength"),
    params: ZValidationRuleParamsMinLength,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxLength"),
    params: ZValidationRuleParamsMaxLength,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("pattern"),
    params: ZValidationRuleParamsPattern,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("email"),
    params: ZValidationRuleParamsEmail,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("url"),
    params: ZValidationRuleParamsUrl,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("phone"),
    params: ZValidationRuleParamsPhone,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minValue"),
    params: ZValidationRuleParamsMinValue,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxValue"),
    params: ZValidationRuleParamsMaxValue,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minSelections"),
    params: ZValidationRuleParamsMinSelections,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("maxSelections"),
    params: ZValidationRuleParamsMaxSelections,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("equals"),
    params: ZValidationRuleParamsEquals,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("doesNotEqual"),
    params: ZValidationRuleParamsDoesNotEqual,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("contains"),
    params: ZValidationRuleParamsContains,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("doesNotContain"),
    params: ZValidationRuleParamsDoesNotContain,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isGreaterThan"),
    params: ZValidationRuleParamsIsGreaterThan,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isLessThan"),
    params: ZValidationRuleParamsIsLessThan,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isLaterThan"),
    params: ZValidationRuleParamsIsLaterThan,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isEarlierThan"),
    params: ZValidationRuleParamsIsEarlierThan,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isBetween"),
    params: ZValidationRuleParamsIsBetween,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("isNotBetween"),
    params: ZValidationRuleParamsIsNotBetween,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minRanked"),
    params: ZValidationRuleParamsMinRanked,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("minRowsAnswered"),
    params: ZValidationRuleParamsMinRowsAnswered,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("fileSizeAtLeast"),
    params: ZValidationRuleParamsFileSizeAtLeast,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("fileSizeAtMost"),
    params: ZValidationRuleParamsFileSizeAtMost,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("fileExtensionIs"),
    params: ZValidationRuleParamsFileExtensionIs,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("fileExtensionIsNot"),
    params: ZValidationRuleParamsFileExtensionIsNot,
    customErrorMessage: ZI18nString.optional(),
    field: ZValidationRuleField.optional(),
  }),
]);

export type TValidationRule = z.infer<typeof ZValidationRule>;

// Array of validation rules
export const ZValidationRules = z.array(ZValidationRule);
export type TValidationRules = z.infer<typeof ZValidationRules>;

// Applicable rules per element type - const arrays for type inference (must be defined before types)
const OPEN_TEXT_RULES = [
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
  "minValue",
  "maxValue",
  "isGreaterThan",
  "isLessThan",
] as const;

const MULTIPLE_CHOICE_SINGLE_RULES = [] as const;
const MULTIPLE_CHOICE_MULTI_RULES = [
  "minSelections",
  "maxSelections",
] as const;
const RATING_RULES = [] as const;
const NPS_RULES = [] as const;
const DATE_RULES = [
  "isLaterThan",
  "isEarlierThan",
  "isBetween",
  "isNotBetween",
] as const;
const CONSENT_RULES = [] as const;
const MATRIX_RULES = ["minRowsAnswered"] as const;
const RANKING_RULES = ["minRanked"] as const;
const FILE_UPLOAD_RULES = ["fileSizeAtLeast", "fileSizeAtMost", "fileExtensionIs", "fileExtensionIsNot"] as const;
const PICTURE_SELECTION_RULES = ["minSelections", "maxSelections"] as const;
// Address and Contact Info can use text-based validation rules on specific fields
const ADDRESS_RULES = [
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
] as const;
const CONTACT_INFO_RULES = [
  "minLength",
  "maxLength",
  "pattern",
  "email",
  "url",
  "phone",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
] as const;
const CAL_RULES = [] as const;
const CTA_RULES = [] as const;

// Applicable rules per element type
export const APPLICABLE_RULES: Record<string, TValidationRuleType[]> = {
  openText: [...OPEN_TEXT_RULES],
  multipleChoiceSingle: [...MULTIPLE_CHOICE_SINGLE_RULES],
  multipleChoiceMulti: [...MULTIPLE_CHOICE_MULTI_RULES],
  rating: [...RATING_RULES],
  nps: [...NPS_RULES],
  date: [...DATE_RULES],
  consent: [...CONSENT_RULES],
  matrix: [...MATRIX_RULES],
  ranking: [...RANKING_RULES],
  fileUpload: [...FILE_UPLOAD_RULES],
  pictureSelection: [...PICTURE_SELECTION_RULES],
  address: [...ADDRESS_RULES],
  contactInfo: [...CONTACT_INFO_RULES],
  cal: [...CAL_RULES],
  cta: [...CTA_RULES], // CTA never validates
};

// Type helper to filter validation rules by allowed types
export type TValidationRuleForElementType<T extends TValidationRuleType> = Extract<
  TValidationRule,
  { type: T }
>;

// Type helper to get validation rules array for specific element type
export type TValidationRulesForElementType<T extends readonly TValidationRuleType[]> =
  TValidationRuleForElementType<T[number]>[];

// Specific validation rule types for each element type
export type TValidationRulesForOpenText = TValidationRulesForElementType<typeof OPEN_TEXT_RULES>;
export type TValidationRulesForMultipleChoiceSingle = TValidationRulesForElementType<
  typeof MULTIPLE_CHOICE_SINGLE_RULES
>;
export type TValidationRulesForMultipleChoiceMulti = TValidationRulesForElementType<
  typeof MULTIPLE_CHOICE_MULTI_RULES
>;
export type TValidationRulesForRating = TValidationRulesForElementType<typeof RATING_RULES>;
export type TValidationRulesForNPS = TValidationRulesForElementType<typeof NPS_RULES>;
export type TValidationRulesForDate = TValidationRulesForElementType<typeof DATE_RULES>;
export type TValidationRulesForConsent = TValidationRulesForElementType<typeof CONSENT_RULES>;
export type TValidationRulesForMatrix = TValidationRulesForElementType<typeof MATRIX_RULES>;
export type TValidationRulesForRanking = TValidationRulesForElementType<typeof RANKING_RULES>;
export type TValidationRulesForFileUpload = TValidationRulesForElementType<typeof FILE_UPLOAD_RULES>;
export type TValidationRulesForPictureSelection = TValidationRulesForElementType<
  typeof PICTURE_SELECTION_RULES
>;
export type TValidationRulesForAddress = TValidationRulesForElementType<typeof ADDRESS_RULES>;
export type TValidationRulesForContactInfo = TValidationRulesForElementType<typeof CONTACT_INFO_RULES>;
export type TValidationRulesForCal = TValidationRulesForElementType<typeof CAL_RULES>;
export type TValidationRulesForCTA = TValidationRulesForElementType<typeof CTA_RULES>;

// Validation error returned by evaluator
export interface TValidationError {
  ruleId: string;
  ruleType: TValidationRuleType;
  message: string;
}

// Validation result for a single element
export interface TValidationResult {
  valid: boolean;
  errors: TValidationError[];
}

// Error map for block-level validation (keyed by elementId)
export type TValidationErrorMap = Record<string, TValidationError[]>;

// Element-specific validation rules schemas (manually created for type safety)
// These are narrowed versions of ZValidationRule that only include applicable rule types
export const ZValidationRulesForOpenText: z.ZodType<TValidationRulesForOpenText> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("minLength"),
      params: ZValidationRuleParamsMinLength,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxLength"),
      params: ZValidationRuleParamsMaxLength,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("pattern"),
      params: ZValidationRuleParamsPattern,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("email"),
      params: ZValidationRuleParamsEmail,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("url"),
      params: ZValidationRuleParamsUrl,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("phone"),
      params: ZValidationRuleParamsPhone,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("minValue"),
      params: ZValidationRuleParamsMinValue,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxValue"),
      params: ZValidationRuleParamsMaxValue,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("equals"),
      params: ZValidationRuleParamsEquals,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("doesNotEqual"),
      params: ZValidationRuleParamsDoesNotEqual,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("contains"),
      params: ZValidationRuleParamsContains,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("doesNotContain"),
      params: ZValidationRuleParamsDoesNotContain,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("isGreaterThan"),
      params: ZValidationRuleParamsIsGreaterThan,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("isLessThan"),
      params: ZValidationRuleParamsIsLessThan,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);


export const ZValidationRulesForMultipleChoiceMulti: z.ZodType<TValidationRulesForMultipleChoiceMulti> =
  z.array(
    z.discriminatedUnion("type", [
      z.object({
        id: z.string(),
        type: z.literal("minSelections"),
        params: ZValidationRuleParamsMinSelections,
        customErrorMessage: ZI18nString.optional(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("maxSelections"),
        params: ZValidationRuleParamsMaxSelections,
        customErrorMessage: ZI18nString.optional(),
      }),
    ])
  );

export const ZValidationRulesForRating: z.ZodType<TValidationRulesForRating> = z.array(z.never());

export const ZValidationRulesForNPS: z.ZodType<TValidationRulesForNPS> = z.array(z.never());

export const ZValidationRulesForDate: z.ZodType<TValidationRulesForDate> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("isLaterThan"),
      params: ZValidationRuleParamsIsLaterThan,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("isEarlierThan"),
      params: ZValidationRuleParamsIsEarlierThan,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("isBetween"),
      params: ZValidationRuleParamsIsBetween,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("isNotBetween"),
      params: ZValidationRuleParamsIsNotBetween,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForConsent: z.ZodType<TValidationRulesForConsent> = z.array(z.never());

export const ZValidationRulesForMatrix: z.ZodType<TValidationRulesForMatrix> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("minRowsAnswered"),
      params: ZValidationRuleParamsMinRowsAnswered,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForRanking: z.ZodType<TValidationRulesForRanking> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("minRanked"),
      params: ZValidationRuleParamsMinRanked,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForFileUpload: z.ZodType<TValidationRulesForFileUpload> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("fileSizeAtLeast"),
      params: ZValidationRuleParamsFileSizeAtLeast,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("fileSizeAtMost"),
      params: ZValidationRuleParamsFileSizeAtMost,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("fileExtensionIs"),
      params: ZValidationRuleParamsFileExtensionIs,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("fileExtensionIsNot"),
      params: ZValidationRuleParamsFileExtensionIsNot,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForPictureSelection: z.ZodType<TValidationRulesForPictureSelection> = z.array(
  z.discriminatedUnion("type", [
    z.object({
      id: z.string(),
      type: z.literal("minSelections"),
      params: ZValidationRuleParamsMinSelections,
      customErrorMessage: ZI18nString.optional(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("maxSelections"),
      params: ZValidationRuleParamsMaxSelections,
      customErrorMessage: ZI18nString.optional(),
    }),
  ])
);

export const ZValidationRulesForAddress: z.ZodType<TValidationRulesForAddress> = z.array(z.never());

export const ZValidationRulesForContactInfo: z.ZodType<TValidationRulesForContactInfo> = z.array(z.never());

export const ZValidationRulesForCal: z.ZodType<TValidationRulesForCal> = z.array(z.never());

export const ZValidationRulesForCTA: z.ZodType<TValidationRulesForCTA> = z.array(z.never());
