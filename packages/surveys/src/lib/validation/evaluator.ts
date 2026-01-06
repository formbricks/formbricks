import type { TFunction } from "i18next";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyOpenTextElement,
} from "@formbricks/types/surveys/elements";
import type {
  TValidationError,
  TValidationErrorMap,
  TValidationResult,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { validators } from "./validators";

/**
 * Check if an element is an OpenText element with inputType
 */
const isOpenTextElement = (element: TSurveyElement): element is TSurveyOpenTextElement => {
  return element.type === ("openText" as TSurveyElementTypeEnum);
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
  const rules: TValidationRule[] = [...(element.validationRules ?? [])];

  // Handle legacy `required` field for backwards compatibility
  // If element.required is true and no explicit "required" rule exists, add one
  if (element.required && !rules.some((r) => r.params.type === "required")) {
    const legacyRequiredRule: TValidationRule = {
      id: "__legacy_required__",
      params: { type: "required" },
      enabled: true,
    };
    rules.unshift(legacyRequiredRule);
  }

  // Handle legacy `inputType` field for OpenText elements
  // If inputType is email/url/phone and no explicit rule exists, add one
  if (isOpenTextElement(element) && element.inputType) {
    const inputTypeToRuleType: Record<string, TValidationRuleType> = {
      email: "email",
      url: "url",
      phone: "phone",
    };

    const ruleType = inputTypeToRuleType[element.inputType];
    if (ruleType && !rules.some((r) => r.params.type === ruleType)) {
      const legacyInputTypeRule: TValidationRule = {
        id: `__legacy_${element.inputType}__`,
        params: { type: ruleType } as TValidationRule["params"],
        enabled: true,
      };
      rules.push(legacyInputTypeRule);
    }
  }

  for (const rule of rules) {
    // Skip disabled rules
    if (rule.enabled === false) {
      continue;
    }

    const ruleType = rule.params.type as TValidationRuleType;
    const validator = validators[ruleType];

    if (!validator) {
      console.warn(`Unknown validation rule type: ${ruleType}`);
      continue;
    }

    const checkResult = validator.check(value, rule.params, element);

    if (!checkResult.valid) {
      // Use custom error message if provided, otherwise use default
      const message =
        rule.customErrorMessage?.[languageCode] ??
        rule.customErrorMessage?.default ??
        validator.getDefaultMessage(rule.params, t);

      errors.push({
        ruleId: rule.id,
        ruleType,
        message,
      });
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


