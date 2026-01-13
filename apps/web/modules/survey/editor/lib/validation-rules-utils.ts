import { TSurveyElementTypeEnum, TSurveyOpenTextElementInputType } from "@formbricks/types/surveys/elements";
import {
  APPLICABLE_RULES,
  TAddressField,
  TContactInfoField,
  TValidationRule,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";

const stringRules: TValidationRuleType[] = [
  "minLength",
  "maxLength",
  "pattern",
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
];

// Rules applicable per field for Address elements
// General text fields don't support format-specific validators (email, url, phone)
export const RULES_BY_ADDRESS_FIELD: Record<TAddressField, TValidationRuleType[]> = {
  addressLine1: stringRules,
  addressLine2: stringRules,
  city: stringRules,
  state: stringRules,
  zip: stringRules,
  country: stringRules,
};

// Rules applicable per field for Contact Info elements
// Note: "email" and "phone" validation are automatically enforced for their respective fields
// and should not appear as selectable options in the UI
export const RULES_BY_CONTACT_INFO_FIELD: Record<TContactInfoField, TValidationRuleType[]> = {
  firstName: stringRules,
  lastName: stringRules,
  email: stringRules,
  phone: ["equals", "doesNotEqual", "contains", "doesNotContain"],
  company: stringRules,
};

// Rules applicable per input type for OpenText
export const RULES_BY_INPUT_TYPE: Record<TSurveyOpenTextElementInputType, TValidationRuleType[]> = {
  text: [
    "minLength",
    "maxLength",
    "pattern",
    // "email", "url", "phone" excluded - redundant for text inputType
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  email: [
    "minLength",
    "maxLength",
    "pattern",
    // "email" rule excluded - redundant when inputType=email (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  url: [
    "minLength",
    "maxLength",
    "pattern",
    // "url" rule excluded - redundant when inputType=url (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  phone: [
    "minLength",
    "maxLength",
    "pattern",
    // "phone" rule excluded - redundant when inputType=phone (HTML5 already validates)
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
  ],
  number: ["minValue", "maxValue", "equals", "doesNotEqual"],
};

/**
 * Get available rule types for an element type, excluding already added rules
 * For OpenText elements, filters rules based on inputType
 * For Address/ContactInfo elements, filters rules based on field
 */
export const getAvailableRuleTypes = (
  elementType: TSurveyElementTypeEnum,
  existingRules: TValidationRule[],
  inputType?: TSurveyOpenTextElementInputType,
  field?: TAddressField | TContactInfoField
): TValidationRuleType[] => {
  const elementTypeKey = elementType.toString();

  // For OpenText, use input-type-based filtering
  if (elementType === TSurveyElementTypeEnum.OpenText && inputType) {
    const applicable = RULES_BY_INPUT_TYPE[inputType] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For Address elements, use field-based filtering
  if (elementType === TSurveyElementTypeEnum.Address) {
    if (!field) {
      // Address elements require a field to be specified for validation rules
      return [];
    }
    const applicable = RULES_BY_ADDRESS_FIELD[field as TAddressField] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For Contact Info elements, use field-based filtering
  if (elementType === TSurveyElementTypeEnum.ContactInfo) {
    if (!field) {
      // Contact Info elements require a field to be specified for validation rules
      return [];
    }
    const applicable = RULES_BY_CONTACT_INFO_FIELD[field as TContactInfoField] ?? [];
    const existingTypes = new Set(existingRules.map((r) => r.type));
    return applicable.filter((ruleType) => !existingTypes.has(ruleType));
  }

  // For other element types, use standard filtering
  const applicable = APPLICABLE_RULES[elementTypeKey] ?? [];
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
    case "minValue":
      return { min: Number(value) || 0 };
    case "maxValue":
      return { max: Number(value) || 100 };
    case "isGreaterThan":
      return { min: Number(value) || 0 };
    case "isLessThan":
      return { max: Number(value) || 100 };
    case "isLaterThan":
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
    case "minRanked":
      return { min: Number(value) || 1 };
    case "rankAll":
      return {};
    case "minRowsAnswered":
      return { min: Number(value) || 1 };
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
