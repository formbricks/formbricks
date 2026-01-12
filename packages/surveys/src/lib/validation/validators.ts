import type { TFunction } from "i18next";
import { ZEmail, ZUrl } from "@formbricks/types/common";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TValidationRuleParams,
  TValidationRuleParamsAnswersProvidedGreaterThan,
  TValidationRuleParamsAnswersProvidedSmallerThan,
  TValidationRuleParamsContains,
  TValidationRuleParamsDoesNotContain,
  TValidationRuleParamsDoesNotEqual,
  TValidationRuleParamsEmail,
  TValidationRuleParamsEquals,
  TValidationRuleParamsFileExtensionIs,
  TValidationRuleParamsFileExtensionIsNot,
  TValidationRuleParamsFileSizeAtLeast,
  TValidationRuleParamsFileSizeAtMost,
  TValidationRuleParamsIsBetween,
  TValidationRuleParamsIsEarlierThan,
  TValidationRuleParamsIsGreaterThan,
  TValidationRuleParamsIsLaterThan,
  TValidationRuleParamsIsLessThan,
  TValidationRuleParamsIsLongerThan,
  TValidationRuleParamsIsNotBetween,
  TValidationRuleParamsIsNotSelected,
  TValidationRuleParamsIsOnOrEarlierThan,
  TValidationRuleParamsIsOnOrLaterThan,
  TValidationRuleParamsIsSelected,
  TValidationRuleParamsIsShorterThan,
  TValidationRuleParamsMaxLength,
  TValidationRuleParamsMaxSelections,
  TValidationRuleParamsMaxValue,
  TValidationRuleParamsMinLength,
  TValidationRuleParamsMinSelections,
  TValidationRuleParamsMinValue,
  TValidationRuleParamsPattern,
  TValidationRuleParamsPhone,
  TValidationRuleParamsPositionIs,
  TValidationRuleParamsPositionIsHigherThan,
  TValidationRuleParamsPositionIsLowerThan,
  TValidationRuleParamsUrl,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { countSelections } from "./validators/selection-utils";

/**
 * Result of a validator check
 */
export interface TValidatorCheckResult {
  valid: boolean;
}

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

// Phone regex: must start with digit or +, end with digit
// Allows digits, +, -, and spaces in between
const PHONE_REGEX = /^\d[\d+\- ]*\d$/;

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
      return { valid: ZEmail.safeParse(value).success };
    },
    getDefaultMessage: (
      _params: TValidationRuleParamsEmail,
      _element: TSurveyElement,
      t: TFunction
    ): string => {
      return t("errors.please_enter_a_valid_email_address");
    },
  },

  url: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: ZUrl.safeParse(value).success };
    },
    getDefaultMessage: (
      _params: TValidationRuleParamsUrl,
      _element: TSurveyElement,
      t: TFunction
    ): string => {
      return t("errors.please_enter_a_valid_url");
    },
  },

  phone: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: PHONE_REGEX.test(value) };
    },
    getDefaultMessage: (
      _params: TValidationRuleParamsPhone,
      _element: TSurveyElement,
      t: TFunction
    ): string => {
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
  isLongerThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsLongerThan;
      // Skip validation if value is not a string or is empty
      if (typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value.length > typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsLongerThan;
      return t("errors.is_longer_than", { min: typedParams.min });
    },
  },
  isShorterThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsShorterThan;
      // Skip validation if value is not a string
      if (typeof value !== "string") {
        return { valid: true };
      }
      return { valid: value.length < typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsShorterThan;
      return t("errors.is_shorter_than", { max: typedParams.max });
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
  isOnOrLaterThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsOnOrLaterThan;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value >= typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsOnOrLaterThan;
      return t("errors.is_on_or_later_than", { date: typedParams.date });
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
  isOnOrEarlierThan: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsOnOrEarlierThan;
      // Skip validation if value is empty
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      // Compare dates as strings (YYYY-MM-DD format)
      return { valid: value <= typedParams.date };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsOnOrEarlierThan;
      return t("errors.is_on_or_earlier_than", { date: typedParams.date });
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
  isSelected: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsSelected;
      if (!value) {
        return { valid: true };
      }
      // Find the choice with the specified optionId
      if (
        (element.type !== "multipleChoiceSingle" && element.type !== "multipleChoiceMulti") ||
        !("choices" in element)
      ) {
        return { valid: true };
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      if (!choice) {
        return { valid: true };
      }
      // Get all language variants of the choice label
      const choiceLabels = Object.values(choice.label);

      // Handle single select (string) and multi select (array) responses
      if (element.type === "multipleChoiceSingle") {
        // Single select: response is a string (choice label)
        if (typeof value !== "string" || value === "") {
          return { valid: true };
        }
        return { valid: choiceLabels.includes(value) };
      } else {
        // Multi select: response is an array of choice labels
        if (!Array.isArray(value) || value.length === 0) {
          return { valid: true };
        }
        // Check if any of the selected labels match the choice labels
        const isSelected = value.some((selectedLabel) => choiceLabels.includes(selectedLabel));
        return { valid: isSelected };
      }
    },
    getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsSelected;
      if (
        (element.type !== "multipleChoiceSingle" && element.type !== "multipleChoiceMulti") ||
        !("choices" in element)
      ) {
        return t("errors.invalid_format");
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      const choiceLabel = choice
        ? choice.label.default || Object.values(choice.label)[0] || typedParams.optionId
        : typedParams.optionId;
      return t("errors.option_must_be_selected", { option: choiceLabel });
    },
  },
  isNotSelected: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsIsNotSelected;
      if (!value) {
        return { valid: true };
      }
      // Find the choice with the specified optionId
      if (
        (element.type !== "multipleChoiceSingle" && element.type !== "multipleChoiceMulti") ||
        !("choices" in element)
      ) {
        return { valid: true };
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      if (!choice) {
        return { valid: true };
      }
      // Get all language variants of the choice label
      const choiceLabels = Object.values(choice.label);

      // Handle single select (string) and multi select (array) responses
      if (element.type === "multipleChoiceSingle") {
        // Single select: response is a string (choice label)
        if (typeof value !== "string" || value === "") {
          return { valid: true };
        }
        return { valid: !choiceLabels.includes(value) };
      } else {
        // Multi select: response is an array of choice labels
        if (!Array.isArray(value) || value.length === 0) {
          return { valid: true };
        }
        // Check if any of the selected labels match the choice labels
        const isSelected = value.some((selectedLabel) => choiceLabels.includes(selectedLabel));
        return { valid: !isSelected };
      }
    },
    getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsIsNotSelected;
      if (
        (element.type !== "multipleChoiceSingle" && element.type !== "multipleChoiceMulti") ||
        !("choices" in element)
      ) {
        return t("errors.invalid_format");
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      const choiceLabel = choice
        ? choice.label.default || Object.values(choice.label)[0] || typedParams.optionId
        : typedParams.optionId;
      return t("errors.option_must_not_be_selected", { option: choiceLabel });
    },
  },
  positionIs: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPositionIs;
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      if (element.type !== "ranking" || !("choices" in element)) {
        return { valid: true };
      }
      // Find the position of the option in the ranking (1-indexed)
      const position = value.findIndex((item) => {
        // Response can be choice IDs or choice labels
        if (item === typedParams.optionId) {
          return true;
        }
        // Check if it's a label that matches the choice
        const choice = element.choices.find((c) => c.id === typedParams.optionId);
        if (choice) {
          const choiceLabels = Object.values(choice.label);
          return choiceLabels.includes(item);
        }
        return false;
      });
      // Position is 1-indexed, so add 1 to array index
      const actualPosition = position === -1 ? 0 : position + 1;
      return { valid: actualPosition === typedParams.position };
    },
    getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsPositionIs;
      if (element.type !== "ranking" || !("choices" in element)) {
        return t("errors.invalid_format");
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      const choiceLabel = choice
        ? choice.label.default || Object.values(choice.label)[0] || typedParams.optionId
        : typedParams.optionId;
      return t("errors.position_must_be", { option: choiceLabel, position: typedParams.position });
    },
  },
  positionIsHigherThan: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPositionIsHigherThan;
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      if (element.type !== "ranking" || !("choices" in element)) {
        return { valid: true };
      }
      // Find the position of the option in the ranking (1-indexed)
      const position = value.findIndex((item) => {
        if (item === typedParams.optionId) {
          return true;
        }
        const choice = element.choices.find((c) => c.id === typedParams.optionId);
        if (choice) {
          const choiceLabels = Object.values(choice.label);
          return choiceLabels.includes(item);
        }
        return false;
      });
      // Position is 1-indexed, so add 1 to array index
      // Higher position means lower position number (better rank)
      const actualPosition = position === -1 ? 0 : position + 1;
      return { valid: actualPosition > 0 && actualPosition < typedParams.position };
    },
    getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsPositionIsHigherThan;
      if (element.type !== "ranking" || !("choices" in element)) {
        return t("errors.invalid_format");
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      const choiceLabel = choice
        ? choice.label.default || Object.values(choice.label)[0] || typedParams.optionId
        : typedParams.optionId;
      return t("errors.position_must_be_higher_than", {
        option: choiceLabel,
        position: typedParams.position,
      });
    },
  },
  positionIsLowerThan: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPositionIsLowerThan;
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      if (element.type !== "ranking" || !("choices" in element)) {
        return { valid: true };
      }
      // Find the position of the option in the ranking (1-indexed)
      const position = value.findIndex((item) => {
        if (item === typedParams.optionId) {
          return true;
        }
        const choice = element.choices.find((c) => c.id === typedParams.optionId);
        if (choice) {
          const choiceLabels = Object.values(choice.label);
          return choiceLabels.includes(item);
        }
        return false;
      });
      // Position is 1-indexed, so add 1 to array index
      // Lower position means higher position number (worse rank)
      const actualPosition = position === -1 ? 0 : position + 1;
      return { valid: actualPosition > typedParams.position };
    },
    getDefaultMessage: (params: TValidationRuleParams, element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsPositionIsLowerThan;
      if (element.type !== "ranking" || !("choices" in element)) {
        return t("errors.invalid_format");
      }
      const choice = element.choices.find((c) => c.id === typedParams.optionId);
      const choiceLabel = choice
        ? choice.label.default || Object.values(choice.label)[0] || typedParams.optionId
        : typedParams.optionId;
      return t("errors.position_must_be_lower_than", { option: choiceLabel, position: typedParams.position });
    },
  },
  answersProvidedGreaterThan: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsAnswersProvidedGreaterThan;
      if (element.type !== "matrix") {
        return { valid: true };
      }
      // Matrix responses are Record<string, string> where keys are row labels and values are column labels
      if (!value || typeof value !== "object" || Array.isArray(value) || value === null) {
        return { valid: true };
      }
      // Count non-empty answers (rows that have been answered)
      const answeredCount = Object.values(value).filter(
        (v) => v !== "" && v !== null && v !== undefined
      ).length;
      return { valid: answeredCount > typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsAnswersProvidedGreaterThan;
      return t("errors.answers_provided_must_be_greater_than", { min: typedParams.min });
    },
  },
  answersProvidedSmallerThan: {
    check: (
      value: TResponseDataValue,
      params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsAnswersProvidedSmallerThan;
      if (element.type !== "matrix") {
        return { valid: true };
      }
      // Matrix responses are Record<string, string> where keys are row labels and values are column labels
      if (!value || typeof value !== "object" || Array.isArray(value) || value === null) {
        return { valid: true };
      }
      // Count non-empty answers (rows that have been answered)
      const answeredCount = Object.values(value).filter(
        (v) => v !== "" && v !== null && v !== undefined
      ).length;
      return { valid: answeredCount < typedParams.max };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsAnswersProvidedSmallerThan;
      return t("errors.answers_provided_must_be_smaller_than", { max: typedParams.max });
    },
  },
  fileSizeAtLeast: {
    check: (
      value: TResponseDataValue,
      _params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      if (element.type !== "fileUpload") {
        return { valid: true };
      }
      // File upload responses are arrays of file URLs (strings)
      // File size validation typically happens client-side before upload
      // For response validation, we skip if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      // Note: File size validation from URLs requires file metadata
      // This is typically validated client-side before upload
      // For now, we return valid as the actual validation happens during upload
      return { valid: true };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileSizeAtLeast;
      const unitLabel = typedParams.unit === "KB" ? "KB" : "MB";
      return t("errors.file_size_must_be_at_least", { size: typedParams.size, unit: unitLabel });
    },
  },
  fileSizeAtMost: {
    check: (
      value: TResponseDataValue,
      _params: TValidationRuleParams,
      element: TSurveyElement
    ): TValidatorCheckResult => {
      if (element.type !== "fileUpload") {
        return { valid: true };
      }
      // File upload responses are arrays of file URLs (strings)
      // File size validation typically happens client-side before upload
      // For response validation, we skip if value is empty
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { valid: true };
      }
      // Note: File size validation from URLs requires file metadata
      // This is typically validated client-side before upload
      // For now, we return valid as the actual validation happens during upload
      return { valid: true };
    },
    getDefaultMessage: (params: TValidationRuleParams, _element: TSurveyElement, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsFileSizeAtMost;
      const unitLabel = typedParams.unit === "KB" ? "KB" : "MB";
      return t("errors.file_size_must_be_at_most", { size: typedParams.size, unit: unitLabel });
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
