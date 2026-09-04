import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TRelativeDateBound,
  TValidationRuleParams,
  TValidationRuleParamsContains,
  TValidationRuleParamsDoesNotContain,
  TValidationRuleParamsDoesNotEqual,
  TValidationRuleParamsEquals,
  TValidationRuleParamsFileExtensionIs,
  TValidationRuleParamsFileExtensionIsNot,
  TValidationRuleParamsIsBetweenFixed,
  TValidationRuleParamsIsEarlierThanFixed,
  TValidationRuleParamsIsGreaterThan,
  TValidationRuleParamsIsLaterThanFixed,
  TValidationRuleParamsIsLessThan,
  TValidationRuleParamsIsNotBetweenFixed,
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
import {
  applyTimezoneGrace,
  hasRelativeBound,
  hasRelativeRange,
  resolveRelativeDate,
  shiftISODate,
} from "./validators/date-utils";
import { countSelections } from "./validators/selection-utils";
import { validateEmail, validatePhone, validateUrl } from "./validators/validation-utils";

type TRelativeRangeParams = {
  relativeStart: TRelativeDateBound;
  relativeEnd: TRelativeDateBound;
};

/**
 * Resolve both ends of a relative range against today.
 *
 * The server-side timezone grace must always widen what is *accepted*, which is not the same as
 * always widening the window. For `isBetween` the answer sits inside the window, so the window
 * grows ("inside"); for `isNotBetween` the answer sits outside it, so the same grace has to shrink
 * the hole ("outside") - widening it there would reject a day the client accepted and make the
 * server stricter than the browser.
 *
 * "none" skips the grace entirely: error messages quote the strict window, so what a respondent is
 * told matches the days the picker offered rather than the slack the server allows on top.
 */
type TRangeGrace = "none" | "accepts-inside" | "accepts-outside";

const resolveRelativeRange = (
  params: TRelativeRangeParams,
  grace: TRangeGrace
): { startDate: string; endDate: string } => {
  const now = new Date();
  const startDate = resolveRelativeDate(params.relativeStart, now);
  const endDate = resolveRelativeDate(params.relativeEnd, now);

  if (grace === "none") return { startDate, endDate };

  if (grace === "accepts-outside") {
    return {
      startDate: applyTimezoneGrace(startDate, "upper"),
      endDate: applyTimezoneGrace(endDate, "lower"),
    };
  }

  return {
    startDate: applyTimezoneGrace(startDate, "lower"),
    endDate: applyTimezoneGrace(endDate, "upper"),
  };
};

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
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format). Relative bounds are inclusive: an offset of
      // "3 days before" means that day itself is still an allowed answer. Fixed bounds keep their
      // original exclusive behaviour.
      if (hasRelativeBound(params)) {
        const bound = applyTimezoneGrace(resolveRelativeDate(params.relative, new Date()), "lower");
        return { valid: value >= bound };
      }
      const typedParams = params as TValidationRuleParamsIsLaterThanFixed;
      return { valid: value > typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      // Relative bounds are resolved to a concrete date so the respondent reads a real day rather
      // than an offset they would have to work out themselves.
      // The relative check is inclusive (>=), but the copy reads "later than", so name the last
      // day that is still rejected instead of the first one that is allowed.
      const date = hasRelativeBound(params)
        ? shiftISODate(resolveRelativeDate(params.relative, new Date()), -1)
        : (params as TValidationRuleParamsIsLaterThanFixed).date;
      return t("errors.is_later_than", { date });
    },
  },
  isEarlierThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      if (hasRelativeBound(params)) {
        const bound = applyTimezoneGrace(resolveRelativeDate(params.relative, new Date()), "upper");
        return { valid: value <= bound };
      }
      const typedParams = params as TValidationRuleParamsIsEarlierThanFixed;
      return { valid: value < typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const date = hasRelativeBound(params)
        ? shiftISODate(resolveRelativeDate(params.relative, new Date()), 1)
        : (params as TValidationRuleParamsIsEarlierThanFixed).date;
      return t("errors.is_earlier_than", { date });
    },
  },
  isBetween: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      if (hasRelativeRange(params)) {
        const { startDate, endDate } = resolveRelativeRange(params, "accepts-inside");
        return { valid: value >= startDate && value <= endDate };
      }
      const typedParams = params as TValidationRuleParamsIsBetweenFixed;
      return { valid: value > typedParams.startDate && value < typedParams.endDate };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const { startDate, endDate } = hasRelativeRange(params)
        ? resolveRelativeRange(params, "none")
        : (params as TValidationRuleParamsIsBetweenFixed);
      return t("errors.is_between", { startDate, endDate });
    },
  },
  isNotBetween: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // The excluded window is inclusive for relative bounds, so a valid answer sits strictly
      // outside it.
      if (hasRelativeRange(params)) {
        const { startDate, endDate } = resolveRelativeRange(params, "accepts-outside");
        return { valid: value < startDate || value > endDate };
      }
      const typedParams = params as TValidationRuleParamsIsNotBetweenFixed;
      return { valid: value < typedParams.startDate || value > typedParams.endDate };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const { startDate, endDate } = hasRelativeRange(params)
        ? resolveRelativeRange(params, "none")
        : (params as TValidationRuleParamsIsNotBetweenFixed);
      return t("errors.is_not_between", { startDate, endDate });
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
