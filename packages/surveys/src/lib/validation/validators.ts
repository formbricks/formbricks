import type { TFunction } from "i18next";
import { ZEmail, ZUrl } from "@formbricks/types/common";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type {
  TValidationRuleParams,
  TValidationRuleParamsEmail,
  TValidationRuleParamsMaxLength,
  TValidationRuleParamsMaxSelections,
  TValidationRuleParamsMaxValue,
  TValidationRuleParamsMinLength,
  TValidationRuleParamsMinSelections,
  TValidationRuleParamsMinValue,
  TValidationRuleParamsPattern,
  TValidationRuleParamsPhone,
  TValidationRuleParamsRequired,
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
  getDefaultMessage: (params: TValidationRuleParams, t: TFunction) => string;
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
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Registry of all validators, keyed by rule type
 */
export const validators: Record<TValidationRuleType, TValidator> = {
  required: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      return { valid: !isEmpty(value) };
    },
    getDefaultMessage: (_params: TValidationRuleParamsRequired, t: TFunction): string => {
      return t("errors.please_fill_out_this_field");
    },
  },

  minLength: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsMinLength;
      // Skip validation if value is not a string or is empty (let required handle empty)
      if (typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: value.length >= typedParams.min };
    },
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
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
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxLength;
      return t("errors.max_length", { max: typedParams.max });
    },
  },

  pattern: {
    check: (value: TResponseDataValue, params: TValidationRuleParams): TValidatorCheckResult => {
      const typedParams = params as TValidationRuleParamsPattern;
      // Skip validation if value is empty (let required handle empty)
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
    getDefaultMessage: (_params: TValidationRuleParams, t: TFunction): string => {
      return t("errors.invalid_format");
    },
  },

  email: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty (let required handle empty)
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: ZEmail.safeParse(value).success };
    },
    getDefaultMessage: (_params: TValidationRuleParamsEmail, t: TFunction): string => {
      return t("errors.please_enter_a_valid_email_address");
    },
  },

  url: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty (let required handle empty)
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: ZUrl.safeParse(value).success };
    },
    getDefaultMessage: (_params: TValidationRuleParamsUrl, t: TFunction): string => {
      return t("errors.please_enter_a_valid_url");
    },
  },

  phone: {
    check: (value: TResponseDataValue): TValidatorCheckResult => {
      // Skip validation if value is empty (let required handle empty)
      if (!value || typeof value !== "string" || value === "") {
        return { valid: true };
      }
      return { valid: PHONE_REGEX.test(value) };
    },
    getDefaultMessage: (_params: TValidationRuleParamsPhone, t: TFunction): string => {
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
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
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
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
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
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
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
    getDefaultMessage: (params: TValidationRuleParams, t: TFunction): string => {
      const typedParams = params as TValidationRuleParamsMaxSelections;
      return t("errors.max_selections", { max: typedParams.max });
    },
  },
};
