import type { TFunction } from "i18next";
import type { TFilterValueType, TRuleOperator, TTableFilterOperator } from "./types";

/** The rule operators that compare against nothing. */
export const NO_VALUE_OPERATORS: readonly TTableFilterOperator[] = ["isSet", "isNotSet"];

export const STRING_RULE_OPERATORS: TRuleOperator[] = [
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
  "isSet",
  "isNotSet",
];

export const NUMBER_RULE_OPERATORS: TRuleOperator[] = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterEqual",
  "lessThan",
  "lessEqual",
  "isSet",
  "isNotSet",
];

export const DATE_RULE_OPERATORS: TRuleOperator[] = ["isBefore", "isAfter", "isSet", "isNotSet"];

export const ENUM_RULE_OPERATORS: TRuleOperator[] = ["equals", "notEquals"];

export const getDefaultRuleOperators = (valueType: TFilterValueType): TRuleOperator[] => {
  switch (valueType) {
    case "number":
      return NUMBER_RULE_OPERATORS;
    case "date":
      return DATE_RULE_OPERATORS;
    case "enum":
      return ENUM_RULE_OPERATORS;
    default:
      return STRING_RULE_OPERATORS;
  }
};

export const operatorTakesValue = (operator: TTableFilterOperator): boolean =>
  !NO_VALUE_OPERATORS.includes(operator);

/** The operator as a filter chip shows it: comparisons as symbols (`Seats > 100`), the rest as words. */
export const getOperatorLabel = (operator: TTableFilterOperator, t: TFunction): string => {
  switch (operator) {
    case "equals":
      return t("common.table_toolbar.operator_equals");
    case "notEquals":
      return t("common.table_toolbar.operator_not_equals");
    case "contains":
      return t("common.table_toolbar.operator_contains");
    case "doesNotContain":
      return t("common.table_toolbar.operator_does_not_contain");
    case "startsWith":
      return t("common.table_toolbar.operator_starts_with");
    case "endsWith":
      return t("common.table_toolbar.operator_ends_with");
    case "greaterThan":
      return ">";
    case "greaterEqual":
      return "≥";
    case "lessThan":
      return "<";
    case "lessEqual":
      return "≤";
    case "isBefore":
      return t("common.table_toolbar.operator_is_before");
    case "isAfter":
      return t("common.table_toolbar.operator_is_after");
    case "isSet":
      return t("common.table_toolbar.operator_is_set");
    case "isNotSet":
      return t("common.table_toolbar.operator_is_not_set");
    case "in":
      return t("common.table_toolbar.operator_is_any_of");
    default:
      return operator;
  }
};

/** The operator as the Advanced filter picker lists it: always in words ("is greater than"). */
export const getOperatorName = (operator: TTableFilterOperator, t: TFunction): string => {
  switch (operator) {
    case "greaterThan":
      return t("common.table_toolbar.operator_greater_than");
    case "greaterEqual":
      return t("common.table_toolbar.operator_greater_equal");
    case "lessThan":
      return t("common.table_toolbar.operator_less_than");
    case "lessEqual":
      return t("common.table_toolbar.operator_less_equal");
    default:
      return getOperatorLabel(operator, t);
  }
};
