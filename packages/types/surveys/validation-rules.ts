import { z } from "zod";
import { ZI18nString } from "../i18n";

// Validation rule type enum - extensible for future rule types
export const ZValidationRuleType = z.enum([
    // Universal rules
    "required",

    // Text/OpenText rules
    "minLength",
    "maxLength",
    "pattern",
    "email",
    "url",
    "phone",

    // Numeric rules (for OpenText inputType=number)
    "minValue",
    "maxValue",

    // Selection rules (MultiSelect, PictureSelection)
    "minSelections",
    "maxSelections",
]);

export type TValidationRuleType = z.infer<typeof ZValidationRuleType>;

// Rule params - discriminated union for type-safe params per rule type
export const ZValidationRuleParamsRequired = z.object({
    type: z.literal("required"),
});

export const ZValidationRuleParamsMinLength = z.object({
    type: z.literal("minLength"),
    min: z.number().min(0),
});

export const ZValidationRuleParamsMaxLength = z.object({
    type: z.literal("maxLength"),
    max: z.number().min(1),
});

export const ZValidationRuleParamsPattern = z.object({
    type: z.literal("pattern"),
    pattern: z.string().min(1),
    flags: z.string().optional(),
});

export const ZValidationRuleParamsEmail = z.object({
    type: z.literal("email"),
});

export const ZValidationRuleParamsUrl = z.object({
    type: z.literal("url"),
});

export const ZValidationRuleParamsPhone = z.object({
    type: z.literal("phone"),
});

export const ZValidationRuleParamsMinValue = z.object({
    type: z.literal("minValue"),
    min: z.number(),
});

export const ZValidationRuleParamsMaxValue = z.object({
    type: z.literal("maxValue"),
    max: z.number(),
});

export const ZValidationRuleParamsMinSelections = z.object({
    type: z.literal("minSelections"),
    min: z.number().min(1),
});

export const ZValidationRuleParamsMaxSelections = z.object({
    type: z.literal("maxSelections"),
    max: z.number().min(1),
});

// Union of all params types
export const ZValidationRuleParams = z.discriminatedUnion("type", [
    ZValidationRuleParamsRequired,
    ZValidationRuleParamsMinLength,
    ZValidationRuleParamsMaxLength,
    ZValidationRuleParamsPattern,
    ZValidationRuleParamsEmail,
    ZValidationRuleParamsUrl,
    ZValidationRuleParamsPhone,
    ZValidationRuleParamsMinValue,
    ZValidationRuleParamsMaxValue,
    ZValidationRuleParamsMinSelections,
    ZValidationRuleParamsMaxSelections,
]);

export type TValidationRuleParams = z.infer<typeof ZValidationRuleParams>;

// Extract specific param types for validators
export type TValidationRuleParamsRequired = z.infer<typeof ZValidationRuleParamsRequired>;
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

// Validation rule stored on element
export const ZValidationRule = z.object({
    id: z.string(),
    params: ZValidationRuleParams,
    customErrorMessage: ZI18nString.optional(),
    enabled: z.boolean().default(true),
});

export type TValidationRule = z.infer<typeof ZValidationRule>;

// Array of validation rules
export const ZValidationRules = z.array(ZValidationRule);
export type TValidationRules = z.infer<typeof ZValidationRules>;

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

// Applicable rules per element type
export const APPLICABLE_RULES: Record<string, TValidationRuleType[]> = {
    openText: ["required", "minLength", "maxLength", "pattern", "email", "url", "phone", "minValue", "maxValue"],
    multipleChoiceSingle: ["required"],
    multipleChoiceMulti: ["required", "minSelections", "maxSelections"],
    rating: ["required"],
    nps: ["required"],
    date: ["required"],
    consent: ["required"],
    matrix: ["required"],
    ranking: ["required"],
    fileUpload: ["required"],
    pictureSelection: ["required", "minSelections", "maxSelections"],
    address: ["required"],
    contactInfo: ["required"],
    cal: ["required"],
    cta: [], // CTA never validates
};

