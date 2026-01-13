import type { TFunction } from "i18next";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TAddressField,
  TContactInfoField,
  TValidationError,
  TValidationErrorMap,
  TValidationResult,
  TValidationRule,
} from "@formbricks/types/surveys/validation-rules";
import { getLocalizedValue } from "@/lib/i18n";
import { validators } from "./validators";

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
 * Create a required field error
 */
const createRequiredError = (t: TFunction): TValidationError => {
  return {
    ruleId: "required",
    ruleType: "minLength", // Structural field only - required is not a validation rule
    message: t("errors.please_fill_out_this_field"),
  } as TValidationError;
};

/**
 * Get field label for address/contact info elements
 */
const getFieldLabel = (
  element: TSurveyElement,
  field: TAddressField | TContactInfoField | undefined,
  languageCode: string
): string | undefined => {
  if (!field) return undefined;

  if (element.type === TSurveyElementTypeEnum.Address && "addressLine1" in element) {
    const fieldConfig = element[field as TAddressField];
    if (fieldConfig && "placeholder" in fieldConfig) {
      return getLocalizedValue(fieldConfig.placeholder, languageCode);
    }
  }

  if (element.type === TSurveyElementTypeEnum.ContactInfo && "firstName" in element) {
    const fieldConfig = element[field as TContactInfoField];
    if (fieldConfig && "placeholder" in fieldConfig) {
      return getLocalizedValue(fieldConfig.placeholder, languageCode);
    }
  }

  return undefined;
};

/**
 * Get default error message from rule or validator
 */
const getDefaultErrorMessage = (
  rule: TValidationRule,
  element: TSurveyElement,
  languageCode: string,
  t: TFunction
): string => {
  const validator = validators[rule.type];
  if (!validator) {
    return t("errors.invalid_format");
  }

  const baseMessage =
    rule.customErrorMessage?.[languageCode] ??
    rule.customErrorMessage?.default ??
    validator.getDefaultMessage(rule.params, element, t);

  // For field-specific validation, prepend the field name
  if (rule.field) {
    const fieldLabel = getFieldLabel(element, rule.field, languageCode);
    if (fieldLabel) {
      return `${fieldLabel}: ${baseMessage}`;
    }
  }

  return baseMessage;
};

/**
 * Single entrypoint for validating an element's response value.
 * Called by block-conditional.tsx during form submission.
 *
 * @param element - The survey element being validated
 * @param value - The response value for this element
 * @param languageCode - Current language code for error messages
 * @param t - i18next translation function
 * @returns Validation result with valid flag and array of errors
 */
export const validateElementResponse = (
  element: TSurveyElement,
  value: TResponseDataValue,
  languageCode: string,
  t: TFunction
): TValidationResult => {
  const errors: TValidationError[] = [];

  // Check if element is required (separate from validation rules)
  // Required is a boolean field on the element, not a validation rule
  if (element.required) {
    // Special handling for ranking elements
    if (element.type === TSurveyElementTypeEnum.Ranking) {
      const isValueArray = Array.isArray(value);
      const atLeastOneRanked = isValueArray && value.length >= 1;

      // If required: at least 1 option must be ranked
      // If not required: partial ranking is allowed (validation only checks if empty)
      if (isEmpty(value) || !atLeastOneRanked) {
        errors.push(createRequiredError(t));
      }
    }
    // Special handling for matrix elements
    else if (element.type === TSurveyElementTypeEnum.Matrix) {
      if (isEmpty(value)) {
        errors.push(createRequiredError(t));
      } else if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        const answeredRows = Object.values(value).filter(
          (v) => v !== "" && v !== null && v !== undefined
        ).length;
        const allRowsAnswered = answeredRows === element.rows.length;
        if (!allRowsAnswered) {
          errors.push(createRequiredError(t));
        }
      }
    }
    // Standard required check for other element types
    else if (isEmpty(value)) {
      errors.push(createRequiredError(t));
    }
  }

  // For matrix elements, skip validation rules if element is required
  // Validation rules should not work when element is marked as required
  if (element.type === TSurveyElementTypeEnum.Matrix && element.required) {
    return { valid: errors.length === 0, errors };
  }

  // Then check validation rules
  const validation = (
    element as TSurveyElement & { validation?: { rules?: TValidationRule[]; logic?: "and" | "or" } }
  ).validation;
  let rules: TValidationRule[] = [...(validation?.rules ?? [])];

  // For OpenText elements, automatically add email/url/phone validation based on inputType
  if (element.type === TSurveyElementTypeEnum.OpenText && "inputType" in element) {
    const inputType = element.inputType;
    // Add implicit validation rule if inputType matches and no explicit rule exists
    if (inputType === "email" && !rules.some((r) => r.type === "email")) {
      rules.push({
        id: "__implicit_email__",
        type: "email",
        params: {},
      } as TValidationRule);
    } else if (inputType === "url" && !rules.some((r) => r.type === "url")) {
      rules.push({
        id: "__implicit_url__",
        type: "url",
        params: {},
      } as TValidationRule);
    } else if (inputType === "phone" && !rules.some((r) => r.type === "phone")) {
      rules.push({
        id: "__implicit_phone__",
        type: "phone",
        params: {},
      } as TValidationRule);
    }
  }

  // For ContactInfo elements, automatically add email/phone validation for their respective fields
  if (element.type === TSurveyElementTypeEnum.ContactInfo) {
    const contactInfoElement = element;

    // Automatically validate email field if it's shown
    if (contactInfoElement.email?.show && !rules.some((r) => r.type === "email" && r.field === "email")) {
      rules.push({
        id: "__implicit_email_field__",
        type: "email",
        field: "email",
        params: {},
      } as TValidationRule);
    }

    // Automatically validate phone field if it's shown
    if (contactInfoElement.phone?.show && !rules.some((r) => r.type === "phone" && r.field === "phone")) {
      rules.push({
        id: "__implicit_phone_field__",
        type: "phone",
        field: "phone",
        params: {},
      } as TValidationRule);
    }
  }

  if (rules.length === 0) {
    return { valid: errors.length === 0, errors };
  }

  // Get validation logic (default to "and" if not specified)
  const validationLogic = validation?.logic ?? "and";

  // Helper function to get field value for address/contact info elements
  const getFieldValue = (rule: TValidationRule, elementValue: TResponseDataValue): TResponseDataValue => {
    // If rule doesn't have a field, validate the whole value
    if (!rule.field) {
      return elementValue;
    }

    // For address and contact info, value is an array
    if (element.type === TSurveyElementTypeEnum.Address && Array.isArray(elementValue)) {
      const addressFieldOrder: TAddressField[] = [
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "zip",
        "country",
      ];
      const fieldIndex = addressFieldOrder.indexOf(rule.field as TAddressField);
      if (fieldIndex >= 0 && fieldIndex < elementValue.length) {
        return elementValue[fieldIndex] ?? "";
      }
    } else if (element.type === TSurveyElementTypeEnum.ContactInfo && Array.isArray(elementValue)) {
      const contactFieldOrder: TContactInfoField[] = ["firstName", "lastName", "email", "phone", "company"];
      const fieldIndex = contactFieldOrder.indexOf(rule.field as TContactInfoField);
      if (fieldIndex >= 0 && fieldIndex < elementValue.length) {
        return elementValue[fieldIndex] ?? "";
      }
    }

    // Fallback: return empty string if field not found
    return "";
  };

  if (validationLogic === "or") {
    // OR logic: at least one rule must pass
    const ruleResults: { valid: boolean; error?: TValidationError }[] = [];

    for (const rule of rules) {
      const ruleType = rule.type;
      const validator = validators[ruleType];

      if (!validator) {
        console.warn(`Unknown validation rule type: ${ruleType}`);
        continue;
      }

      // Get the value to validate (field-specific for address/contact info)
      const valueToValidate = getFieldValue(rule, value);
      const checkResult = validator.check(valueToValidate, rule.params, element);

      if (checkResult.valid) {
        // At least one rule passed, validation succeeds
        return { valid: errors.length === 0, errors };
      } else {
        // Rule failed, store the error
        const message = getDefaultErrorMessage(rule, element, languageCode, t);
        ruleResults.push({
          valid: false,
          error: {
            ruleId: rule.id,
            ruleType,
            message,
          },
        });
      }
    }

    // All rules failed, add all errors
    for (const result of ruleResults) {
      if (result.error) {
        errors.push(result.error);
      }
    }
  } else {
    // AND logic (default): all rules must pass
    for (const rule of rules) {
      const ruleType = rule.type;
      const validator = validators[ruleType];

      if (!validator) {
        console.warn(`Unknown validation rule type: ${ruleType}`);
        continue;
      }

      // Get the value to validate (field-specific for address/contact info)
      const valueToValidate = getFieldValue(rule, value);
      const checkResult = validator.check(valueToValidate, rule.params, element);

      if (!checkResult.valid) {
        const message = getDefaultErrorMessage(rule, element, languageCode, t);

        errors.push({
          ruleId: rule.id,
          ruleType,
          message,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validate all elements in a block, returning an error map.
 *
 * @param elements - Array of elements to validate
 * @param responses - Response data keyed by element ID
 * @param languageCode - Current language code for error messages
 * @param t - i18next translation function
 * @returns Map of element IDs to their validation errors
 */
export const validateBlockResponses = (
  elements: TSurveyElement[],
  responses: TResponseData,
  languageCode: string,
  t: TFunction
): TValidationErrorMap => {
  const errorMap: TValidationErrorMap = {};

  for (const element of elements) {
    const result = validateElementResponse(element, responses[element.id], languageCode, t);
    if (!result.valid) {
      errorMap[element.id] = result.errors;
    }
  }

  return errorMap;
};

/**
 * Get the first error message for an element from the error map.
 * Useful for UI components that only display one error at a time.
 *
 * @param errorMap - The validation error map
 * @param elementId - The element ID to get error for
 * @returns The first error message or undefined
 */
export const getFirstErrorMessage = (
  errorMap: TValidationErrorMap,
  elementId: string
): string | undefined => {
  const errors = errorMap[elementId];
  return errors?.[0]?.message;
};
