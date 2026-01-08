import type { TFunction } from "i18next";
import type { TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TValidationRuleParams } from "@formbricks/types/surveys/validation-rules";

/**
 * Result of a validator check
 */
export interface TValidatorCheckResult {
  valid: boolean;
}

/**
 * Generic validator interface
 * P = the specific params type for this validator
 */
export interface TValidator<P extends TValidationRuleParams = TValidationRuleParams> {
  /**
   * Check if the value passes validation
   */
  check: (value: TResponseDataValue, params: P, element: TSurveyElement) => TValidatorCheckResult;

  /**
   * Get the default error message for this rule
   */
  getDefaultMessage: (params: P, t: TFunction) => string;
}
