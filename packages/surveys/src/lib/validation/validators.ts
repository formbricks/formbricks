import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TValidationRuleParams,
  TValidationRuleParamsContains,
  TValidationRuleParamsDoesNotContain,
  TValidationRuleParamsDoesNotEqual,
  TValidationRuleParamsEmail,
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
  TValidationRuleParamsPhone,
  TValidationRuleParamsUrl,
  TValidationRuleType,
  TValidatorCheckResult,
} from "@formbricks/types/surveys/validation-rules";
import { countSelections } from "./validators/selection-utils";
import { validateEmail, validatePhone, validateUrl } from "./validators/validation-utils";

/**
 * Generic validator interface
 * Uses type assertions internally to handle the discriminated union params
 */
export interface TValidator {
  check: (
    value: TResponseDataValue,
    params: TValidationRuleParams,
    element: TSurveyElement
  ) => TValidatorCheckResult;
  getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t?: TFunction) => string;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinLength;
      return t ? t("errors.min_length", { min: typedParams.min }) : `Minimum length is ${typedParams.min}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxLength;
      return t ? t("errors.max_length", { max: typedParams.max }) : `Maximum length is ${typedParams.max}`;
    },
  },

  pattern: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPattern;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }

      // ReDoS protection: cap pattern length to prevent catastrophic backtracking
      // Patterns longer than 512 chars can cause exponential time complexity
      if (typedParams.pattern.length > 512) {
        console.warn(`Pattern too long (${typedParams.pattern.length} chars), rejecting to prevent ReDoS`);
        return { valid: false };
      }

      // ReDoS protection: cap value length to prevent exponential backtracking
      // Values longer than 4096 chars can cause main-thread lockup with malicious patterns
      if (value.length > 4096) {
        console.warn(`Value too long (${value.length} chars), rejecting to prevent ReDoS`);
        return { valid: false };
      }

      try {
        const regex = new RegExp(typedParams.pattern, typedParams.flags);
        return { valid: regex.test(value) };
      } catch {
        // If regex is invalid, consider it valid (design-time should catch this)
        console.warn(`Invalid regex pattern: ${typedParams.pattern}`);
        return { valid: true };
      }
    },
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t ? t("errors.invalid_format") : "Invalid format";
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
    getDefaultMessage: (
      _params: TValidationRuleParamsEmail,
      _element: TSurveyElement,
      t?: TFunction
    ): string => {
      return t ? t("errors.please_enter_a_valid_email_address") : "Please enter a valid email address";
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
    getDefaultMessage: (
      _params: TValidationRuleParamsUrl,
      _element: TSurveyElement,
      t?: TFunction
    ): string => {
      return t ? t("errors.please_enter_a_valid_url") : "Please enter a valid URL";
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
    getDefaultMessage: (
      _params: TValidationRuleParamsPhone,
      _element: TSurveyElement,
      t?: TFunction
    ): string => {
      return t ? t("errors.please_enter_a_valid_phone_number") : "Please enter a valid phone number";
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinValue;
      return t ? t("errors.min_value", { min: typedParams.min }) : `Minimum value is ${typedParams.min}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxValue;
      return t ? t("errors.max_value", { max: typedParams.max }) : `Maximum value is ${typedParams.max}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinSelections;
      return t
        ? t("errors.min_selections", { min: typedParams.min })
        : `Minimum selections is ${typedParams.min}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxSelections;
      return t
        ? t("errors.max_selections", { max: typedParams.max })
        : `Maximum selections is ${typedParams.max}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t
        ? t("errors.value_must_equal", { value: (_params as TValidationRuleParamsEquals).value })
        : `Value must be equal to ${(_params as TValidationRuleParamsEquals).value}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t
        ? t("errors.value_must_not_equal", {
            value: (_params as TValidationRuleParamsDoesNotEqual).value,
          })
        : `Value must not be equal to ${(_params as TValidationRuleParamsDoesNotEqual).value}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t
        ? t("errors.value_must_contain", { value: (_params as TValidationRuleParamsContains).value })
        : `Value must contain ${(_params as TValidationRuleParamsContains).value}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t
        ? t("errors.value_must_not_contain", {
            value: (_params as TValidationRuleParamsDoesNotContain).value,
          })
        : `Value must not contain ${(_params as TValidationRuleParamsDoesNotContain).value}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsGreaterThan;
      return t
        ? t("errors.is_greater_than", { min: typedParams.min })
        : `Value must be greater than ${typedParams.min}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsLessThan;
      return t
        ? t("errors.is_less_than", { max: typedParams.max })
        : `Value must be less than ${typedParams.max}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsLaterThan;
      return t
        ? t("errors.is_later_than", { date: typedParams.date })
        : `Value must be later than ${typedParams.date}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsEarlierThan;
      return t
        ? t("errors.is_earlier_than", { date: typedParams.date })
        : `Value must be earlier than ${typedParams.date}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsBetween;
      return t
        ? t("errors.is_between", { startDate: typedParams.startDate, endDate: typedParams.endDate })
        : `Value must be between ${typedParams.startDate} and ${typedParams.endDate}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsNotBetween;
      return t
        ? t("errors.is_not_between", { startDate: typedParams.startDate, endDate: typedParams.endDate })
        : `Value must not be between ${typedParams.startDate} and ${typedParams.endDate}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinRanked;
      return t
        ? t("errors.minimum_options_ranked", { min: typedParams.min })
        : `Minimum options ranked is ${typedParams.min}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t ? t("errors.all_options_must_be_ranked") : "All options must be ranked";
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMinRowsAnswered;
      return t
        ? t("errors.minimum_rows_answered", { min: typedParams.min })
        : `Minimum rows answered is ${typedParams.min}`;
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
    getDefaultMessage: (_params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      return t ? t("errors.all_rows_must_be_answered") : "All rows must be answered";
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileExtensionIs;
      const extensions = typedParams.extensions
        .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
        .join(", ");
      return t
        ? t("errors.file_extension_must_be", { extension: extensions })
        : `File extension must be ${extensions}`;
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
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t?: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileExtensionIsNot;
      const extensions = typedParams.extensions
        .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
        .join(", ");
      return t
        ? t("errors.file_extension_must_not_be", { extension: extensions })
        : `File extension must not be ${extensions}`;
    },
  },
};
