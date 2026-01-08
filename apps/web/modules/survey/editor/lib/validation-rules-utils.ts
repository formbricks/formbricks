import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  APPLICABLE_RULES,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";

/**
 * Get available rule types for an element type, excluding already added rules
 */
export const getAvailableRuleTypes = (
  elementType: TSurveyElementTypeEnum,
  existingRules: TValidationRule[]
): TValidationRuleType[] => {
  const elementTypeKey = elementType.toString();
  const applicable = APPLICABLE_RULES[elementTypeKey] ?? [];

  // Filter out rules that are already added (for non-repeatable rules)
  const existingTypes = new Set(existingRules.map((r) => r.type));

  return applicable.filter((ruleType) => {
    // Allow only one of each rule type
    return !existingTypes.has(ruleType);
  });
};

/**
 * Get the value from rule params based on rule type
 */
export const getRuleValue = (rule: TValidationRule): number | string | undefined => {
  const params = rule.params as Record<string, unknown>;
  if ("min" in params) return params.min as number;
  if ("max" in params) return params.max as number;
  if ("pattern" in params) {
    const pattern = params.pattern as string;
    return pattern ?? "";
  }
  return undefined;
};

/**
 * Create params object from rule type and value (without type field)
 */
export const createRuleParams = (
  ruleType: TValidationRuleType,
  value?: number | string
): TValidationRule["params"] => {
  switch (ruleType) {
    case "required":
      return {};
    case "minLength":
      return { min: Number(value) || 0 };
    case "maxLength":
      return { max: Number(value) || 100 };
    case "pattern":
      return { pattern: value === undefined || value === null ? "" : String(value) };
    case "email":
      return {};
    case "url":
      return {};
    case "phone":
      return {};
    case "minValue":
      return { min: Number(value) || 0 };
    case "maxValue":
      return { max: Number(value) || 100 };
    case "minSelections":
      return { min: Number(value) || 1 };
    case "maxSelections":
      return { max: Number(value) || 3 };
    default:
      return {};
  }
};
