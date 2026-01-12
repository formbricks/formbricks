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
    valuePlaceholder: "value",
  },
  doesNotEqual: {
    labelKey: "is_not",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "value",
  },
  contains: {
    labelKey: "contains",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "text",
  },
  doesNotContain: {
    labelKey: "does_not_contain",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "text",
  },
  isLongerThan: {
    labelKey: "is_longer_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "100",
    unitOptions: [{ value: "characters", labelKey: "characters" }],
  },
  isShorterThan: {
    labelKey: "is_shorter_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "500",
    unitOptions: [{ value: "characters", labelKey: "characters" }],
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
  isOnOrLaterThan: {
    labelKey: "is_on_or_later_than",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD",
  },
  isLaterThan: {
    labelKey: "is_later_than",
    needsValue: true,
    valueType: "text",
    valuePlaceholder: "YYYY-MM-DD",
  },
  isOnOrEarlierThan: {
    labelKey: "is_on_or_earlier_than",
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
  isSelected: {
    labelKey: "is_selected",
    needsValue: true,
    valueType: "option",
  },
  isNotSelected: {
    labelKey: "is_not_selected",
    needsValue: true,
    valueType: "option",
  },
  positionIs: {
    labelKey: "position_is",
    needsValue: true,
    valueType: "ranking",
  },
  positionIsHigherThan: {
    labelKey: "position_is_higher_than",
    needsValue: true,
    valueType: "ranking",
  },
  positionIsLowerThan: {
    labelKey: "position_is_lower_than",
    needsValue: true,
    valueType: "ranking",
  },
  answersProvidedGreaterThan: {
    labelKey: "answers_provided_greater_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "1",
  },
  answersProvidedSmallerThan: {
    labelKey: "answers_provided_smaller_than",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "5",
  },
  fileSizeAtLeast: {
    labelKey: "file_size_at_least",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "1",
    unitOptions: [
      { value: "KB", labelKey: "kb" },
      { value: "MB", labelKey: "mb" },
    ],
  },
  fileSizeAtMost: {
    labelKey: "file_size_at_most",
    needsValue: true,
    valueType: "number",
    valuePlaceholder: "5",
    unitOptions: [
      { value: "KB", labelKey: "kb" },
      { value: "MB", labelKey: "mb" },
    ],
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
