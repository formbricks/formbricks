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
  const params = rule.params;
  if ("min" in params) return params.min;
  if ("max" in params) return params.max;
  if ("pattern" in params) {
    const pattern = params.pattern;
    return pattern ?? "";
  }
  if ("value" in params) {
    return params.value;
  }
  if ("date" in params) {
    return params.date;
  }
  if ("startDate" in params && "endDate" in params) {
    return `${params.startDate},${params.endDate}`;
  }
  // Check for ranking rules first (they have both optionId and position)
  if (
    rule.type === "positionIs" ||
    rule.type === "positionIsHigherThan" ||
    rule.type === "positionIsLowerThan"
  ) {
    // After checking rule.type, TypeScript narrows rule.params to ranking rule params
    if ("position" in rule.params) {
      const positionValue = rule.params.position;
      if (typeof positionValue === "number") {
        return positionValue;
      }
    }
    return undefined;
  }
  if ("optionId" in params) {
    // For single/multi select rules, return optionId
    return params.optionId;
  }
  // File upload rules
  if ("size" in params && "unit" in params) {
    // For file size rules, return size as number (unit is stored separately)
    return params.size;
  }
  if ("extensions" in params) {
    // For file extension rules, return extensions array as comma-separated string for display
    const extensions = params.extensions;
    return extensions.length > 0 ? extensions.join(", ") : "";
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
    case "equals":
      return { value: value === undefined || value === null ? "" : String(value) };
    case "doesNotEqual":
      return { value: value === undefined || value === null ? "" : String(value) };
    case "contains":
      return { value: value === undefined || value === null ? "" : String(value) };
    case "doesNotContain":
      return { value: value === undefined || value === null ? "" : String(value) };
    case "isLongerThan":
      return { min: Number(value) || 0 };
    case "isShorterThan":
      return { max: Number(value) || 100 };
    case "minValue":
      return { min: Number(value) || 0 };
    case "maxValue":
      return { max: Number(value) || 100 };
    case "isGreaterThan":
      return { min: Number(value) || 0 };
    case "isLessThan":
      return { max: Number(value) || 100 };
    case "isOnOrLaterThan":
      return { date: value === undefined || value === null ? "" : String(value) };
    case "isLaterThan":
      return { date: value === undefined || value === null ? "" : String(value) };
    case "isOnOrEarlierThan":
      return { date: value === undefined || value === null ? "" : String(value) };
    case "isEarlierThan":
      return { date: value === undefined || value === null ? "" : String(value) };
    case "isBetween":
    case "isNotBetween": {
      if (typeof value === "string" && value.includes(",")) {
        const [startDate, endDate] = value.split(",");
        return {
          startDate: startDate?.trim() || "",
          endDate: endDate?.trim() || "",
        };
      }
      return { startDate: "", endDate: "" };
    }
    case "minSelections":
      return { min: Number(value) || 1 };
    case "maxSelections":
      return { max: Number(value) || 3 };
    case "isSelected":
    case "isNotSelected":
      return { optionId: value === undefined || value === null ? "" : String(value) };
    case "positionIs":
    case "positionIsHigherThan":
    case "positionIsLowerThan":
      // For ranking rules, value is a comma-separated string: "optionId,position"
      if (typeof value === "string" && value.includes(",")) {
        const [optionId, position] = value.split(",");
        return {
          optionId: optionId?.trim() || "",
          position: Number(position?.trim()) || 1,
        };
      }
      // Fallback: assume value is just the position, optionId will be set separately
      return {
        optionId: "",
        position: Number(value) || 1,
      };
    case "answersProvidedGreaterThan":
      return { min: Number(value) || 1 };
    case "answersProvidedSmallerThan":
      return { max: Number(value) || 5 };
    case "fileSizeAtLeast":
      // Value should be number, unit is handled separately in the UI
      return { size: Number(value) || 1, unit: "MB" as const };
    case "fileSizeAtMost":
      // Value should be number, unit is handled separately in the UI
      return { size: Number(value) || 5, unit: "MB" as const };
    case "fileExtensionIs":
    case "fileExtensionIsNot": {
      // Handle array of extensions (from MultiSelect) or comma-separated string
      if (Array.isArray(value)) {
        return { extensions: value };
      }
      if (typeof value === "string" && value.includes(",")) {
        // Comma-separated string
        return { extensions: value.split(",").map((ext) => ext.trim()) };
      }
      // Single value as string
      const extensionValue = value === undefined || value === null ? "" : String(value);
      return { extensions: extensionValue ? [extensionValue] : [] };
    }
    default:
      return {};
  }
};
