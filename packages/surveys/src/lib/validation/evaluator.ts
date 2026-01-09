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
 * Get required error message based on element type
 */
const getRequiredErrorMessage = (
  element: TSurveyElement,
  value: TResponseDataValue,
  t: TFunction
): string => {
  // Special handling for ranking elements
  if (element.type === TSurveyElementTypeEnum.Ranking) {
    const rankingMessage = getRankingErrorMessage(element, value, t);
    if (rankingMessage) return rankingMessage;
  }

  // Special handling for matrix elements
  if (element.type === TSurveyElementTypeEnum.Matrix) {
    const matrixMessage = getMatrixErrorMessage(element, value, t);
    if (matrixMessage) return matrixMessage;
  }

  // Provide element-specific error messages for better UX
  switch (element.type) {
    case TSurveyElementTypeEnum.Date:
      return t("errors.please_select_a_date");
    case TSurveyElementTypeEnum.Cal:
      return t("errors.please_book_an_appointment");
    case TSurveyElementTypeEnum.FileUpload:
      return t("errors.please_upload_a_file");
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.PictureSelection:
    case TSurveyElementTypeEnum.Matrix:
      return t("errors.please_select_an_option");
    default:
      return t("errors.please_fill_out_this_field");
  }
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

  // First check if element is required (using boolean field, not validation rules)
  if (element.required) {
    // Special handling for ranking elements
    if (element.type === TSurveyElementTypeEnum.Ranking) {
      const isValueArray = Array.isArray(value);
      const allItemsRanked = isValueArray && value.length === element.choices.length;

      // If any items are ranked, all must be ranked
      if (isValueArray && value.length > 0 && !allItemsRanked) {
        errors.push({
          ruleId: "required",
          ruleType: "minLength", // Placeholder - required is not a validation rule type anymore
          message: getRequiredErrorMessage(element, value, t),
        } as TValidationError);
        // Continue to check validation rules even if required fails
      } else if (isEmpty(value)) {
        errors.push({
          ruleId: "required",
          ruleType: "minLength", // Placeholder - required is not a validation rule type anymore
          message: getRequiredErrorMessage(element, value, t),
        } as TValidationError);
        // Continue to check validation rules even if required fails
      }
    }
    // Special handling for matrix elements
    else if (element.type === TSurveyElementTypeEnum.Matrix) {
      if (isEmpty(value)) {
        errors.push({
          ruleId: "required",
          ruleType: "minLength", // Placeholder - required is not a validation rule type anymore
          message: getRequiredErrorMessage(element, value, t),
        } as TValidationError);
        // Continue to check validation rules even if required fails
      } else if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        const answeredRows = Object.values(value).filter(
          (v) => v !== "" && v !== null && v !== undefined
        ).length;
        const allRowsAnswered = answeredRows === element.rows.length;
        if (!allRowsAnswered) {
          errors.push({
            ruleId: "required",
            ruleType: "minLength", // Placeholder - required is not a validation rule type anymore
            message: getRequiredErrorMessage(element, value, t),
          } as TValidationError);
          // Continue to check validation rules even if required fails
        }
      }
    }
    // Standard required check for other element types
    else if (isEmpty(value)) {
      errors.push({
        ruleId: "required",
        ruleType: "minLength", // Placeholder - required is not a validation rule type anymore
        message: getRequiredErrorMessage(element, value, t),
      } as TValidationError);
      // Continue to check validation rules even if required fails
    }
  }

  // Then check validation rules
  const rules: TValidationRule[] = [
    ...((element as TSurveyElement & { validationRules?: TValidationRule[]; validationLogic?: "and" | "or" })
      .validationRules ?? []),
  ];

  if (rules.length === 0) {
    return { valid: errors.length === 0, errors };
  }

  // Get validation logic (default to "and" if not specified)
  const validationLogic =
    (element as TSurveyElement & { validationLogic?: "and" | "or" }).validationLogic ?? "and";

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

      const checkResult = validator.check(value, rule.params, element);

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

      const checkResult = validator.check(value, rule.params, element);

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
