import type { TFunction } from "i18next";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TValidationError,
  TValidationErrorMap,
  TValidationResult,
  TValidationRule,
} from "@formbricks/types/surveys/validation-rules";
import { validators } from "./validators";

/**
 * Get error message for incomplete ranking
 */
const getRankingErrorMessage = (
  element: TSurveyElement,
  value: TResponseDataValue,
  t: TFunction
): string | null => {
  if (
    element.type === TSurveyElementTypeEnum.Ranking &&
    Array.isArray(value) &&
    value.length > 0 &&
    value.length < element.choices.length
  ) {
    return t("errors.please_rank_all_items_before_submitting");
  }
  return null;
};

/**
 * Get error message for incomplete matrix
 */
const getMatrixErrorMessage = (
  element: TSurveyElement,
  value: TResponseDataValue,
  t: TFunction
): string | null => {
  if (
    element.type === TSurveyElementTypeEnum.Matrix &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value !== null
  ) {
    const answeredRows = Object.values(value).filter((v) => v !== "" && v !== null && v !== undefined).length;
    if (answeredRows > 0 && answeredRows < element.rows.length) {
      return t("errors.please_submit_all_rows_before_submitting");
    }
  }
  return null;
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
  return (
    rule.customErrorMessage?.[languageCode] ??
    rule.customErrorMessage?.default ??
    validator.getDefaultMessage(rule.params, element, t)
  );
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
  const rules: TValidationRule[] = [
    ...((element as TSurveyElement & { validationRules?: TValidationRule[] }).validationRules ?? []),
  ];

  for (const rule of rules) {
    const ruleType = rule.type;
    const validator = validators[ruleType];

    if (!validator) {
      console.warn(`Unknown validation rule type: ${ruleType}`);
      continue;
    }

    const checkResult = validator.check(value, rule.params, element);

    if (!checkResult.valid) {
      // Try to get element-specific error messages first
      const rankingMessage = ruleType === "required" ? getRankingErrorMessage(element, value, t) : null;
      const matrixMessage = ruleType === "required" ? getMatrixErrorMessage(element, value, t) : null;

      const message =
        rankingMessage ?? matrixMessage ?? getDefaultErrorMessage(rule, element, languageCode, t);

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
