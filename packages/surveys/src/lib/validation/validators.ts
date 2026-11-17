import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TValidationRuleParams,
  TValidationRuleParamsContains,
  TValidationRuleParamsDoesNotContain,
  TValidationRuleParamsDoesNotEqual,
  TValidationRuleParamsEquals,
  TValidationRuleParamsFileExtensionIs,
  TValidationRuleParamsFileExtensionIsNot,
  TValidationRuleParamsIsBetween,
  TValidationRuleParamsIsEarlierThan,
  TValidationRuleParamsIsGreaterThan,
  TValidationRuleParamsIsLaterThan,
  TValidationRuleParamsIsLessThan,
  TValidationRuleParamsIsNotBetween,
  TValidationRuleParamsMaxLength,
  TValidationRuleParamsMaxSelections,
  TValidationRuleParamsMaxValue,
  TValidationRuleParamsMinLength,
  TValidationRuleParamsMinRanked,
  TValidationRuleParamsMinRowsAnswered,
  TValidationRuleParamsMinSelections,
  TValidationRuleParamsMinValue,
  TValidationRuleParamsPattern,
  TValidationRuleType,
  TValidatorCheckResult,
} from "@formbricks/types/surveys/validation-rules";
import { countSelections } from "./validators/selection-utils";
import { validateEmail, validatePhone, validateUrl } from "./validators/validation-utils";

/**
 * Tests a value against a survey author's `pattern` rule. Returns `undefined` when the engine cannot
 * evaluate the pattern (invalid, or a feature the engine does not support); the rule then passes, as
 * an invalid pattern always has.
 */
export type TPatternMatcher = (
  pattern: string,
  flags: string | undefined,
  value: string
) => boolean | undefined;

export interface TValidationOptions {
  /**
   * Engine for `pattern` rules. Defaults to the native backtracking `RegExp`, which is fine in a
   * respondent's own browser tab but not on a server: a pattern such as `^(a+)+$` takes exponential
   * time on a short input and would block the event loop for every tenant. Servers pass a linear-time
   * matcher.
   */
  matchPattern?: TPatternMatcher;
}

/** The browser engine: native, backtracking `RegExp`. Only for the respondent's own tab. */
export const matchPatternWithRegExp: TPatternMatcher = (pattern, flags, value) => {
  try {
    return new RegExp(pattern, flags).test(value);
  } catch {
    return undefined;
  }
};

/**
 * Generic validator interface
 * Uses type assertions internally to handle the discriminated union params
 */
export interface TValidator {
  check: (
    value: TResponseDataValue,
    params: TValidationRuleParams,
    element: TSurveyElement,
    options?: TValidationOptions
  ) => TValidatorCheckResult;
  getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction) => string;
}

/**
 * Check if a value is empty
 */
const isEmpty = (value: TResponseDataValue): boolean => {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0)
  );
};

/**
 * Parse numeric value from string or number
 */
const parseNumericValue = (value: TResponseDataValue): number | null => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Registry of all validators, keyed by rule type
 */
export const validators: Record<TValidationRuleType, TValidator> = {
  minLength: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinLength;
      // Skip validation if value is not a string or is empty
      if (typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value.length >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinLength;
      return t("errors.min_length", { min: typedParams.min });
    },
  },

  maxLength: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMaxLength;
      // Skip validation if value is not a string
      if (typeof value !== "string") {
        return { valid: true };
      }
      return { valid: value.length <= typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxLength;
      return t("errors.max_length", { max: typedParams.max });
    },
  },

  pattern: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      _element: TSurveyElement,
      options?: TValidationOptions
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPattern;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }

      // Size caps. They bound the work of a linear-time engine; they do not prevent catastrophic
      // backtracking in a backtracking one, which is why servers pass `options.matchPattern`.
      if (typedParams.pattern.length > 512) {
        console.warn(`Pattern too long (${typedParams.pattern.length} chars), rejecting`);
        return { valid: false };
      }

      if (value.length > 4096) {
        console.warn(`Value too long (${value.length} chars), rejecting`);
        return { valid: false };
      }

      const matchPattern = options?.matchPattern ?? matchPatternWithRegExp;
      const matches = matchPattern(typedParams.pattern, typedParams.flags, value);
      if (matches === undefined) {
        // An invalid pattern, or one this engine cannot run: pass (design-time should catch this).
        console.warn(`Pattern cannot be evaluated: ${typedParams.pattern}`);
        return { valid: true };
      }

      return { valid: matches };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.invalid_format");
    },
  },

  email: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: validateEmail(value) };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.please_enter_a_valid_email_address");
    },
  },

  url: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: validateUrl(value) };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.please_enter_a_valid_url");
    },
  },

  phone: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: validatePhone(value) };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.please_enter_a_valid_phone_number");
    },
  },

  minValue: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinValue;
      // Skip validation if value is empty (let required handle empty)
      if (isEmpty(value)) {
        return { valid: true };
      }

      const numValue = parseNumericValue(value);
      if (numValue === null) {
        return { valid: true }; // Let pattern/type validation handle non-numeric
      }

      return { valid: numValue >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinValue;
      return t("errors.min_value", { min: typedParams.min });
    },
  },

  maxValue: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMaxValue;
      // Skip validation if value is empty (let required handle empty)
      if (isEmpty(value)) {
        return { valid: true };
      }

      const numValue = parseNumericValue(value);
      if (numValue === null) {
        return { valid: true }; // Let pattern/type validation handle non-numeric
      }

      return { valid: numValue <= typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxValue;
      return t("errors.max_value", { max: typedParams.max });
    },
  },

  minSelections: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinSelections;
      // If value is not an array, check fails (need selections)
      if (!Array.isArray(value)) {
        return { valid: false };
      }

      const selectionCount = countSelections(value);
      return { valid: selectionCount >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinSelections;
      return t("errors.min_selections", { min: typedParams.min });
    },
  },

  maxSelections: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMaxSelections;
      // If value is not an array, rule doesn't apply (graceful)
      if (!Array.isArray(value)) {
        return { valid: true };
      }

      const selectionCount = countSelections(value);
      return { valid: selectionCount <= typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxSelections;
      return t("errors.max_selections", { max: typedParams.max });
    },
  },
  equals: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsEquals;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value === typedParams.value };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.value_must_equal", { value: (_params as TValidationRuleParamsEquals).value });
    },
  },
  doesNotEqual: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsDoesNotEqual;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value !== typedParams.value };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.value_must_not_equal", {
        value: (_params as TValidationRuleParamsDoesNotEqual).value,
      });
    },
  },
  contains: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsContains;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value.includes(typedParams.value) };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.value_must_contain", { value: (_params as TValidationRuleParamsContains).value });
    },
  },
  doesNotContain: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsDoesNotContain;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: !value.includes(typedParams.value) };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.value_must_not_contain", {
        value: (_params as TValidationRuleParamsDoesNotContain).value,
      });
    },
  },
  isGreaterThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsGreaterThan;
      // Skip validation if value is empty (let required handle empty)
      if (isEmpty(value)) {
        return { valid: true };
      }

      const numValue = parseNumericValue(value);
      if (numValue === null) {
        return { valid: true }; // Let pattern/type validation handle non-numeric
      }

      return { valid: numValue > typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsGreaterThan;
      return t("errors.is_greater_than", { min: typedParams.min });
    },
  },
  isLessThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsLessThan;
      // Skip validation if value is empty (let required handle empty)
      if (isEmpty(value)) {
        return { valid: true };
      }

      const numValue = parseNumericValue(value);
      if (numValue === null) {
        return { valid: true }; // Let pattern/type validation handle non-numeric
      }

      return { valid: numValue < typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsLessThan;
      return t("errors.is_less_than", { max: typedParams.max });
    },
  },
  isLaterThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsLaterThan;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value > typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsLaterThan;
      return t("errors.is_later_than", { date: typedParams.date });
    },
  },
  isEarlierThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsEarlierThan;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value < typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsEarlierThan;
      return t("errors.is_earlier_than", { date: typedParams.date });
    },
  },
  isBetween: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsBetween;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value > typedParams.startDate && value < typedParams.endDate };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsBetween;
      return t("errors.is_between", { startDate: typedParams.startDate, endDate: typedParams.endDate });
    },
  },
  isNotBetween: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsNotBetween;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value < typedParams.startDate || value > typedParams.endDate };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsNotBetween;
      return t("errors.is_not_between", { startDate: typedParams.startDate, endDate: typedParams.endDate });
    },
  },
  minRanked: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinRanked;
      // Skip validation if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      if (element.type !== "ranking") {
        return { valid: true };
      }
      // Count how many options have been ranked (array length)
      const rankedCount = value.length;
      return { valid: rankedCount >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinRanked;
      return t("errors.minimum_options_ranked", { min: typedParams.min });
    },
  },
  rankAll: {
    check: (
      value: TResponseDataValue,
      _params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      if (element.type !== "ranking") {
        return { valid: true };
      }
      // Skip validation if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      // All options must be ranked
      const allItemsRanked = value.length === element.choices.length;
      return { valid: allItemsRanked };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.all_options_must_be_ranked");
    },
  },
  minRowsAnswered: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinRowsAnswered;
      // Skip validation if value is empty
      if (!value || typeof value !== "object" || Array.isArray(value) || value === null) {
        return { valid: true };
      }
      if (element.type !== "matrix") {
        return { valid: true };
      }
      // Matrix responses are Record<string, string> where keys are row labels and values are column labels
      // Count non-empty answers (rows that have been answered)
      const answeredCount = Object.values(value).filter(
        (v) => v !== "" && v !== null && v !== undefined
      ).length;
      return { valid: answeredCount >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinRowsAnswered;
      return t("errors.minimum_rows_answered", { min: typedParams.min });
    },
  },
  answerAllRows: {
    check: (
      value: TResponseDataValue,
      _params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      if (element.type !== "matrix") {
        return { valid: true };
      }
      // Skip validation if value is empty (let required handle empty)
      if (!value || typeof value !== "object" || Array.isArray(value) || value === null) {
        return { valid: true };
      }
      // Matrix responses are Record<string, string> where keys are localized row labels
      // Count non-empty answers (rows that have been answered)
      const answeredCount = Object.values(value).filter(
        (v) => v !== "" && v !== null && v !== undefined
      ).length;
      // All rows must be answered
      const allRowsAnswered = answeredCount === element.rows.length;
      return { valid: allRowsAnswered };
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      return t("errors.all_rows_must_be_answered");
    },
  },
  fileExtensionIs: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsFileExtensionIs;
      if (element.type !== "fileUpload") {
        return { valid: true };
      }
      // Skip validation if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      // Normalize expected extensions: ensure they start with a dot
      const expectedExtensions = new Set(
        typedParams.extensions.map((ext) =>
          ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
        )
      );

      // Check all files in the array
      for (const fileUrl of value) {
        if (typeof fileUrl !== "string") continue;
        // Extract filename from URL
        const urlPath = fileUrl.split("?")[0]; // Remove query params
        const fileName = urlPath.split("/").pop() || "";
        if (!fileName.includes(".")) {
          return { valid: false };
        }
        const fileExtension = `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
        // Check if file extension matches any of the expected extensions
        if (!expectedExtensions.has(fileExtension)) {
          return { valid: false };
        }
      }
      return { valid: true };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileExtensionIs;
      const extensions = typedParams.extensions
        .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
        .join(", ");
      return t("errors.file_extension_must_be", { extension: extensions });
    },
  },
  fileExtensionIsNot: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsFileExtensionIsNot;
      if (element.type !== "fileUpload") {
        return { valid: true };
      }
      // Skip validation if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      // Normalize forbidden extensions: ensure they start with a dot
      const forbiddenExtensions = new Set(
        typedParams.extensions.map((ext) =>
          ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`
        )
      );

      // Check all files in the array
      for (const fileUrl of value) {
        if (typeof fileUrl !== "string") continue;
        // Extract filename from URL
        const urlPath = fileUrl.split("?")[0]; // Remove query params
        const fileName = urlPath.split("/").pop() || "";
        if (!fileName.includes(".")) {
          continue; // Files without extensions are allowed
        }
        const fileExtension = `.${fileName.split(".").pop()?.toLowerCase() ?? ""}`;
        // Check if file extension matches any of the forbidden extensions
        if (forbiddenExtensions.has(fileExtension)) {
          return { valid: false };
        }
      }
      return { valid: true };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileExtensionIsNot;
      const extensions = typedParams.extensions
        .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
        .join(", ");
      return t("errors.file_extension_must_not_be", { extension: extensions });
    },
  },
};
