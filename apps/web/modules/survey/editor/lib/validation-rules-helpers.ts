import { TSurveyElement } from "@formbricks/types/surveys/elements";
import {
  TAddressField,
  TContactInfoField,
  TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { RULE_TYPE_CONFIG } from "./validation-rules-config";

// Field options for address elements
export const getAddressFields = (t: (key: string) => string): { value: TAddressField; label: string }[] => [
  { value: "addressLine1", label: t("environments.surveys.edit.address_line_1") },
  { value: "addressLine2", label: t("environments.surveys.edit.address_line_2") },
  { value: "city", label: t("environments.surveys.edit.city") },
  { value: "state", label: t("environments.surveys.edit.state") },
  { value: "zip", label: t("environments.surveys.edit.zip") },
  { value: "country", label: t("environments.surveys.edit.country") },
];

// Field options for contact info elements
export const getContactInfoFields = (
  t: (key: string) => string
): { value: TContactInfoField; label: string }[] => [
  { value: "firstName", label: t("environments.surveys.edit.first_name") },
  { value: "lastName", label: t("environments.surveys.edit.last_name") },
  { value: "email", label: t("common.email") },
  { value: "phone", label: t("common.phone") },
  { value: "company", label: t("environments.surveys.edit.company") },
];

// Rule labels mapping
export const getRuleLabels = (t: (key: string) => string): Record<string, string> => ({
  min_length: t("environments.surveys.edit.validation.min_length"),
  max_length: t("environments.surveys.edit.validation.max_length"),
  pattern: t("environments.surveys.edit.validation.pattern"),
  email: t("environments.surveys.edit.validation.email"),
  url: t("environments.surveys.edit.validation.url"),
  phone: t("environments.surveys.edit.validation.phone"),
  min_value: t("environments.surveys.edit.validation.min_value"),
  max_value: t("environments.surveys.edit.validation.max_value"),
  min_selections: t("environments.surveys.edit.validation.min_selections"),
  max_selections: t("environments.surveys.edit.validation.max_selections"),
  characters: t("environments.surveys.edit.validation.characters"),
  options_selected: t("environments.surveys.edit.validation.options_selected"),
  is: t("environments.surveys.edit.validation.is"),
  is_not: t("environments.surveys.edit.validation.is_not"),
  contains: t("environments.surveys.edit.validation.contains"),
  does_not_contain: t("environments.surveys.edit.validation.does_not_contain"),
  is_greater_than: t("environments.surveys.edit.validation.is_greater_than"),
  is_less_than: t("environments.surveys.edit.validation.is_less_than"),
  is_later_than: t("environments.surveys.edit.validation.is_later_than"),
  is_earlier_than: t("environments.surveys.edit.validation.is_earlier_than"),
  is_between: t("environments.surveys.edit.validation.is_between"),
  is_not_between: t("environments.surveys.edit.validation.is_not_between"),
  minimum_options_ranked: t("environments.surveys.edit.validation.minimum_options_ranked"),
  rank_all_options: t("environments.surveys.edit.validation.rank_all_options"),
  minimum_rows_answered: t("environments.surveys.edit.validation.minimum_rows_answered"),
  file_extension_is: t("environments.surveys.edit.validation.file_extension_is"),
  file_extension_is_not: t("environments.surveys.edit.validation.file_extension_is_not"),
  kb: t("environments.surveys.edit.validation.kb"),
  mb: t("environments.surveys.edit.validation.mb"),
});

// Helper function to get default value for a validation rule based on its config and element
export const getDefaultRuleValue = (
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType],
  element?: TSurveyElement
): number | string | undefined => {
  if (!config.needsValue) {
    return undefined;
  }

  if (config.valueType === "text") {
    return "";
  }

  if (config.valueType === "option") {
    if (element && "choices" in element) {
      const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
      return firstChoice?.id ?? "";
    }
    return "";
  }

  if (config.valueType === "ranking") {
    if (element && "choices" in element) {
      const firstChoice = element.choices.find((c) => c.id !== "other" && c.id !== "none");
      return firstChoice ? `${firstChoice.id},1` : ",1";
    }
    return ",1";
  }

  return undefined;
};

// Helper function to normalize file extension format
export const normalizeFileExtension = (value: string): string => {
  return value.startsWith(".") ? value : `.${value}`;
};

// Helper function to parse and validate rule value based on rule type
export const parseRuleValue = (
  ruleType: TValidationRuleType,
  value: string,
  config: (typeof RULE_TYPE_CONFIG)[TValidationRuleType]
): string | number => {
  // Handle file extension formatting: auto-add dot if missing
  if (ruleType === "fileExtensionIs" || ruleType === "fileExtensionIsNot") {
    return normalizeFileExtension(value);
  }

  if (config.valueType === "number") {
    return Number(value) || 0;
  }

  return value;
};
