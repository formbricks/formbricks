import type { TFunction } from "i18next";
import {
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowConditionValue,
  isWorkflowChoiceIds,
  toSurveyConditionOperator,
} from "@formbricks/workflows";
import type { TChoiceLabels } from "@/modules/ee/workflows/lib/choice-conditions";
import { type TVariableLabels, getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";

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

// Typed values read in quotes, as the survey flow editor writes them (“gold”); numbers stay bare.
const quote = (text: string) => `“${text}”`;

// A value still to be filled in (the field was just changed, the box is empty) reads as "…", so the
// sentence never shows its template's placeholder.
const PENDING_VALUE = "…";

const PRESENCE_OPERATORS = new Set(["isSet", "isNotSet", "isEmpty", "isNotEmpty"]);

/** The words a condition's sentence fills in; a presence check compares no value. */
const toConditionWords = (
  condition: TWorkflowCondition,
  labels?: TVariableLabels,
  choiceLabels?: TChoiceLabels
): TConditionWords => {
  const variable = getVariableDisplayName(condition.left.path, labels);
  return PRESENCE_OPERATORS.has(toSurveyConditionOperator(condition.operator))
    ? { variable }
    : {
        variable,
        value: toValueText(condition.right, labels, choiceLabels?.get(condition.left.path)),
      };
};

const toValueText = (
  value: TWorkflowConditionValue | undefined,
  labels?: TVariableLabels,
  choices?: ReadonlyMap<string, string>
): string => {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return PENDING_VALUE;
  }
  // Picked choices read by their label, as the survey flow editor shows them (DC11); a choice the
  // survey no longer has reads by its id.
  if (isWorkflowChoiceIds(value)) {
    return value.choiceIds.map((id) => quote(choices?.get(id) ?? id)).join(", ");
  }
  // A list operator compares against a list of texts (ENG-7176).
  if (Array.isArray(value)) return value.map((item) => quote(String(item))).join(", ");
  if (value !== null && typeof value === "object") return getVariableDisplayName(value.path, labels);
  return typeof value === "string" ? quote(value) : String(value);
};

/**
 * The If/else card's summary: its first condition in words ("channel is call"), plus how many
 * more follow ("… and 2 more"). Null when there is no condition to describe or its operator is
 * not one this summary knows.
 */
export const describeIfElseCondition = (
  group: TWorkflowConditionGroup,
  t: TFunction,
  labels?: TVariableLabels,
  choiceLabels?: TChoiceLabels
): string | null => {
  const [first, ...rest] = flattenConditions(group);
  if (!first) return null;

  const condition = describeComparison(first.operator, toConditionWords(first, labels, choiceLabels), t);
  if (condition === null || rest.length === 0) return condition;
  return t("workspace.workflows.if_else_summary_more", { condition, count: rest.length });
};

/** One condition in words ("channel is call"), as run detail lists them; null for an unknown operator. */
export const describeWorkflowCondition = (
  condition: TWorkflowCondition,
  t: TFunction,
  labels?: TVariableLabels,
  choiceLabels?: TChoiceLabels
): string | null =>
  describeComparison(condition.operator, toConditionWords(condition, labels, choiceLabels), t);
