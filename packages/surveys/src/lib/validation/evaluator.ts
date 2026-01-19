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

  const baseMessage = validator.getDefaultMessage(rule.params, element, t);

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
 * Validate required field for ranking elements
 */
const validateRequiredRanking = (value: TResponseDataValue, t: TFunction): TValidationError | null => {
  const isValueArray = Array.isArray(value);
  const atLeastOneRanked = isValueArray && value.length >= 1;
  if (isEmpty(value) || !atLeastOneRanked) {
    return createRequiredError(t);
  }
  return null;
};

/**
 * Validate required field for matrix elements
 * Required means: at least 1 row must be answered
 */
const validateRequiredMatrix = (
  value: TResponseDataValue,
  element: TSurveyElement,
  t: TFunction
): TValidationError | null => {
  if (isEmpty(value)) {
    return createRequiredError(t);
  }
  if (typeof value === "object" && !Array.isArray(value) && value !== null && "rows" in element) {
    const answeredRows = Object.values(value).filter((v) => v !== "" && v !== null && v !== undefined).length;
    // Required means at least 1 row must be answered
    if (answeredRows === 0) {
      return createRequiredError(t);
    }
  }
  return null;
};

/**
 * Check required field validation
 */
const checkRequiredField = (
  element: TSurveyElement,
  value: TResponseDataValue,
  t: TFunction
): TValidationError | null => {
  if (!element.required) {
    return null;
  }

  if (element.type === TSurveyElementTypeEnum.Ranking) {
    return validateRequiredRanking(value, t);
  }

  if (element.type === TSurveyElementTypeEnum.Matrix) {
    return validateRequiredMatrix(value, element, t);
  }

  if (isEmpty(value)) {
    return createRequiredError(t);
  }

  return null;
};

/**
 * Add implicit validation rules for OpenText elements based on inputType
 */
const addImplicitOpenTextRules = (element: TSurveyElement, rules: TValidationRule[]): TValidationRule[] => {
  if (element.type !== TSurveyElementTypeEnum.OpenText || !("inputType" in element)) {
    return rules;
  }

  const inputType = element.inputType;
  const hasRule = (type: string) => rules.some((r) => r.type === type);

  if (inputType === "email" && !hasRule("email")) {
    rules.push({
      id: "__implicit_email__",
      type: "email",
      params: {},
    } as TValidationRule);
  } else if (inputType === "url" && !hasRule("url")) {
    rules.push({
      id: "__implicit_url__",
      type: "url",
      params: {},
    } as TValidationRule);
  } else if (inputType === "phone" && !hasRule("phone")) {
    rules.push({
      id: "__implicit_phone__",
      type: "phone",
      params: {},
    } as TValidationRule);
  }

  return rules;
};

/**
 * Add implicit validation rules for ContactInfo elements
 */
const addImplicitContactInfoRules = (
  element: TSurveyElement,
  rules: TValidationRule[]
): TValidationRule[] => {
  if (element.type !== TSurveyElementTypeEnum.ContactInfo) {
    return rules;
  }

  const contactInfoElement = element;
  const hasFieldRule = (type: string, field: string) =>
    rules.some((r) => r.type === type && r.field === field);

  if (contactInfoElement.email?.show && !hasFieldRule("email", "email")) {
    rules.push({
      id: "__implicit_email_field__",
      type: "email",
      field: "email",
      params: {},
    } as TValidationRule);
  }

  if (contactInfoElement.phone?.show && !hasFieldRule("phone", "phone")) {
    rules.push({
      id: "__implicit_phone_field__",
      type: "phone",
      field: "phone",
      params: {},
    } as TValidationRule);
  }

  return rules;
};

/**
 * Get field value for address/contact info elements
 */
const getFieldValue = (
  rule: TValidationRule,
  element: TSurveyElement,
  elementValue: TResponseDataValue
): TResponseDataValue => {
  if (!rule.field) {
    return elementValue;
  }

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
  }

  if (element.type === TSurveyElementTypeEnum.ContactInfo && Array.isArray(elementValue)) {
    const contactFieldOrder: TContactInfoField[] = ["firstName", "lastName", "email", "phone", "company"];
    const fieldIndex = contactFieldOrder.indexOf(rule.field as TContactInfoField);
    if (fieldIndex >= 0 && fieldIndex < elementValue.length) {
      return elementValue[fieldIndex] ?? "";
    }
  }

  return "";
};

/**
 * Execute validation rules with OR logic
 */
const executeOrLogic = (
  rules: TValidationRule[],
  element: TSurveyElement,
  value: TResponseDataValue,
  languageCode: string,
  t: TFunction,
  initialErrors: TValidationError[]
): TValidationResult => {
  const ruleResults: TValidationError[] = [];

  for (const rule of rules) {
    const validator = validators[rule.type];
    if (!validator) {
      console.warn(`Unknown validation rule type: ${rule.type}`);
      continue;
    }

    const valueToValidate = getFieldValue(rule, element, value);
    const checkResult = validator.check(valueToValidate, rule.params, element);

    if (checkResult.valid) {
      return { valid: initialErrors.length === 0, errors: initialErrors };
    }

    const message = getDefaultErrorMessage(rule, element, languageCode, t);
    ruleResults.push({
      ruleId: rule.id,
      ruleType: rule.type,
      message,
    });
  }

  return { valid: false, errors: [...initialErrors, ...ruleResults] };
};

/**
 * Execute validation rules with AND logic
 */
const executeAndLogic = (
  rules: TValidationRule[],
  element: TSurveyElement,
  value: TResponseDataValue,
  languageCode: string,
  t: TFunction,
  initialErrors: TValidationError[]
): TValidationResult => {
  const errors = [...initialErrors];

  for (const rule of rules) {
    const validator = validators[rule.type];
    if (!validator) {
      console.warn(`Unknown validation rule type: ${rule.type}`);
      continue;
    }

    const valueToValidate = getFieldValue(rule, element, value);
    const checkResult = validator.check(valueToValidate, rule.params, element);

    if (!checkResult.valid) {
      const message = getDefaultErrorMessage(rule, element, languageCode, t);
      errors.push({
        ruleId: rule.id,
        ruleType: rule.type,
        message,
      });
    }
  }

  return { valid: errors.length === 0, errors };
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
  const requiredError = checkRequiredField(element, value, t);
  if (requiredError) {
    errors.push(requiredError);
  }

  // Validation rules apply to matrix elements regardless of required status

  // Get validation rules
  const validation = (
    element as TSurveyElement & { validation?: { rules?: TValidationRule[]; logic?: "and" | "or" } }
  ).validation;
  let rules: TValidationRule[] = [...(validation?.rules ?? [])];

  // Add implicit rules based on element type
  rules = addImplicitOpenTextRules(element, rules);
  rules = addImplicitContactInfoRules(element, rules);

  if (rules.length === 0) {
    return { valid: errors.length === 0, errors };
  }

  const validationLogic = validation?.logic ?? "and";

  if (validationLogic === "or") {
    return executeOrLogic(rules, element, value, languageCode, t, errors);
  }

  return executeAndLogic(rules, element, value, languageCode, t, errors);
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
