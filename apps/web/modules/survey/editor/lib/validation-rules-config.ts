import { TValidationRuleType } from "@formbricks/types/surveys/validation-rules";

// Rule type definitions with i18n keys
export const RULE_TYPE_CONFIG: Record<
  TValidationRuleType,
  {
    labelKey: string;
    needsValue: boolean;
    valueType?: "number" | "text" | "option" | "ranking";
    valuePlaceholder?: string;
    unitOptions?: { value: string; labelKey: string }[];
  }
> = {
  minLength: {
    labelKey: "min_length",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "100",
    unitOptions: [{ value: "characters", labelKey: "characters" }],
  },
  maxLength: {
    labelKey: "max_length",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "500",
    unitOptions: [{ value: "characters", labelKey: "characters" }],
  },
  pattern: {
    labelKey: "pattern",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "^[A-Z].*",
  },
  email: {
    labelKey: "email",
    needsValue: false,
  },
  url: {
    labelKey: "url",
    needsValue: false,
  },
  phone: {
    labelKey: "phone",
    needsValue: false,
  },
  minValue: {
    labelKey: "min_value",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "0",
  },
  maxValue: {
    labelKey: "max_value",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "100",
  },
  minSelections: {
    labelKey: "min_selections",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "1",
    unitOptions: [{ value: "options", labelKey: "options_selected" }],
  },
  maxSelections: {
    labelKey: "max_selections",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "3",
    unitOptions: [{ value: "options", labelKey: "options_selected" }],
  },
  equals: {
    labelKey: "is",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Value",
  },
  doesNotEqual: {
    labelKey: "is_not",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Value",
  },
  contains: {
    labelKey: "contains",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Text",
  },
  doesNotContain: {
    labelKey: "does_not_contain",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Text",
  },
  isGreaterThan: {
    labelKey: "is_greater_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "0",
  },
  isLessThan: {
    labelKey: "is_less_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "100",
  },
  isLaterThan: {
    labelKey: "is_later_than",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD",
  },
  isEarlierThan: {
    labelKey: "is_earlier_than",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD",
  },
  isBetween: {
    labelKey: "is_between",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD,YYYY-MM-DD",
  },
  isNotBetween: {
    labelKey: "is_not_between",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD,YYYY-MM-DD",
  },
  minRanked: {
    labelKey: "minimum_options_ranked",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "1",
  },
  rankAll: {
    labelKey: "rank_all_options",
    needsValue: false,
  },
  minRowsAnswered: {
    labelKey: "minimum_rows_answered",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "1",
  },
  fileExtensionIs: {
    labelKey: "file_extension_is",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Select extensions...",
  },
  fileExtensionIsNot: {
    labelKey: "file_extension_is_not",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "Select extensions...",
  },
};
