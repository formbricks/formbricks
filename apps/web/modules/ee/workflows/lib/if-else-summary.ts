import type { TFunction } from "i18next";
import {
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowConditionValue,
  toSurveyConditionOperator,
} from "@formbricks/workflows";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";

type TConditionWords = { variable: string; value?: string };

// One key per operator so each language orders variable, verb and value its own way. Literal
// `t()` calls keep every key visible to the translation scanner. Legacy names (ADR 0050) read as the
// survey operator they mean.
const describeComparison = (
  operator: TWorkflowCondition["operator"],
  words: TConditionWords,
  t: TFunction
): string | null => {
  switch (toSurveyConditionOperator(operator)) {
    case "equals":
      return t("workspace.workflows.if_else_operator_equals", words);
    case "doesNotEqual":
      return t("workspace.workflows.if_else_operator_not_equals", words);
    case "isLessThan":
      return t("workspace.workflows.if_else_operator_less_than", words);
    case "isLessThanOrEqual":
      return t("workspace.workflows.if_else_operator_less_equal", words);
    case "isGreaterThan":
      return t("workspace.workflows.if_else_operator_greater_than", words);
    case "isGreaterThanOrEqual":
      return t("workspace.workflows.if_else_operator_greater_equal", words);
    case "contains":
      return t("workspace.workflows.if_else_operator_contains", words);
    case "doesNotContain":
      return t("workspace.workflows.if_else_operator_not_contains", words);
    case "startsWith":
      return t("workspace.workflows.if_else_operator_starts_with", words);
    case "doesNotStartWith":
      return t("workspace.workflows.if_else_operator_not_starts_with", words);
    case "endsWith":
      return t("workspace.workflows.if_else_operator_ends_with", words);
    case "doesNotEndWith":
      return t("workspace.workflows.if_else_operator_not_ends_with", words);
    case "isBefore":
      return t("workspace.workflows.if_else_operator_is_before", words);
    case "isAfter":
      return t("workspace.workflows.if_else_operator_is_after", words);
    case "equalsOneOf":
      return t("workspace.workflows.if_else_operator_equals_one_of", words);
    case "includesAllOf":
      return t("workspace.workflows.if_else_operator_includes_all_of", words);
    case "includesOneOf":
      return t("workspace.workflows.if_else_operator_includes_one_of", words);
    case "doesNotIncludeAllOf":
      return t("workspace.workflows.if_else_operator_not_includes_all_of", words);
    case "doesNotIncludeOneOf":
      return t("workspace.workflows.if_else_operator_not_includes_one_of", words);
    case "isSet":
      return t("workspace.workflows.if_else_operator_exists", words);
    case "isNotSet":
      return t("workspace.workflows.if_else_operator_not_exists", words);
    case "isEmpty":
      return t("workspace.workflows.if_else_operator_is_empty", words);
    case "isNotEmpty":
      return t("workspace.workflows.if_else_operator_is_not_empty", words);
    default:
      return null;
  }
};

const isConditionGroup = (
  item: TWorkflowCondition | TWorkflowConditionGroup
): item is TWorkflowConditionGroup => "conditions" in item;

const flattenConditions = (group: TWorkflowConditionGroup): TWorkflowCondition[] =>
  group.conditions.flatMap((item) => (isConditionGroup(item) ? flattenConditions(item) : [item]));

const toValueText = (value: TWorkflowConditionValue): string => {
  // A list operator compares against a list of texts (ENG-7176).
  if (Array.isArray(value)) return value.join(", ");
  if (value !== null && typeof value === "object") return getVariableDisplayName(value.path);
  return String(value);
};

/**
 * The If/else card's summary: its first condition in words ("channel is call"), plus how many
 * more follow ("… and 2 more"). Null when there is no condition to describe or its operator is
 * not one this summary knows.
 */
export const describeIfElseCondition = (group: TWorkflowConditionGroup, t: TFunction): string | null => {
  const [first, ...rest] = flattenConditions(group);
  if (!first) return null;

  const condition = describeComparison(
    first.operator,
    {
      variable: getVariableDisplayName(first.left.path),
      ...(first.right === undefined ? {} : { value: toValueText(first.right) }),
    },
    t
  );
  if (condition === null || rest.length === 0) return condition;
  return t("workspace.workflows.if_else_summary_more", { condition, count: rest.length });
};

/** One condition in words ("channel is call"), as run detail lists them; null for an unknown operator. */
export const describeWorkflowCondition = (condition: TWorkflowCondition, t: TFunction): string | null =>
  describeComparison(
    condition.operator,
    {
      variable: getVariableDisplayName(condition.left.path),
      ...(condition.right === undefined ? {} : { value: toValueText(condition.right) }),
    },
    t
  );
