import type { TFunction } from "i18next";
import type {
  TWorkflowCondition,
  TWorkflowConditionGroup,
  TWorkflowConditionValue,
} from "@formbricks/workflows";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";

type TConditionWords = { variable: string; value?: string };

// One key per operator so each language orders variable, verb and value its own way. Literal
// `t()` calls keep every key visible to the translation scanner.
const describeComparison = (
  operator: TWorkflowCondition["operator"],
  words: TConditionWords,
  t: TFunction
): string | null => {
  switch (operator) {
    case "equals":
      return t("workspace.workflows.if_else_operator_equals", words);
    case "notEquals":
      return t("workspace.workflows.if_else_operator_not_equals", words);
    case "lessThan":
      return t("workspace.workflows.if_else_operator_less_than", words);
    case "lessEqual":
      return t("workspace.workflows.if_else_operator_less_equal", words);
    case "greaterThan":
      return t("workspace.workflows.if_else_operator_greater_than", words);
    case "greaterEqual":
      return t("workspace.workflows.if_else_operator_greater_equal", words);
    case "contains":
      return t("workspace.workflows.if_else_operator_contains", words);
    case "notContains":
      return t("workspace.workflows.if_else_operator_not_contains", words);
    case "exists":
      return t("workspace.workflows.if_else_operator_exists", words);
    case "notExists":
      return t("workspace.workflows.if_else_operator_not_exists", words);
    default:
      // Operators this summary doesn't know yet (ENG-7165 moves to survey operator names).
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
