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
export const ZValidationRule = z.object({
  id: z.string(),
  type: ZValidationRuleType,
  params: ZValidationRuleParams,
  customErrorMessage: ZI18nString.optional(),
  field: ZValidationRuleField.optional(),
});

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

const MULTIPLE_CHOICE_MULTI_RULES = ["minSelections", "maxSelections"] as const;
const DATE_RULES = ["isLaterThan", "isEarlierThan", "isBetween", "isNotBetween"] as const;
const MATRIX_RULES = ["minRowsAnswered"] as const;
const RANKING_RULES = ["minRanked"] as const;
const FILE_UPLOAD_RULES = [
  "fileSizeAtLeast",
  "fileSizeAtMost",
  "fileExtensionIs",
  "fileExtensionIsNot",
] as const;
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

// Applicable rules per element type
export const APPLICABLE_RULES: Record<string, TValidationRuleType[]> = {
  openText: [...OPEN_TEXT_RULES],
  multipleChoiceMulti: [...MULTIPLE_CHOICE_MULTI_RULES],
  date: [...DATE_RULES],
  matrix: [...MATRIX_RULES],
  ranking: [...RANKING_RULES],
  fileUpload: [...FILE_UPLOAD_RULES],
  pictureSelection: [...PICTURE_SELECTION_RULES],
  address: [...ADDRESS_RULES],
  contactInfo: [...CONTACT_INFO_RULES],
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
export type TValidationRulesForMultipleChoiceMulti = TValidationRulesForElementType<
  typeof MULTIPLE_CHOICE_MULTI_RULES
>;
export type TValidationRulesForDate = TValidationRulesForElementType<typeof DATE_RULES>;
export type TValidationRulesForMatrix = TValidationRulesForElementType<typeof MATRIX_RULES>;
export type TValidationRulesForRanking = TValidationRulesForElementType<typeof RANKING_RULES>;
export type TValidationRulesForFileUpload = TValidationRulesForElementType<typeof FILE_UPLOAD_RULES>;
export type TValidationRulesForPictureSelection = TValidationRulesForElementType<
  typeof PICTURE_SELECTION_RULES
>;
export type TValidationRulesForAddress = TValidationRulesForElementType<typeof ADDRESS_RULES>;
export type TValidationRulesForContactInfo = TValidationRulesForElementType<typeof CONTACT_INFO_RULES>;

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
