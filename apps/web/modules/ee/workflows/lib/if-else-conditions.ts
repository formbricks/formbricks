import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import {
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowConditionValue,
  type TWorkflowDefinition,
  type TWorkflowSurveyConditionOperator,
  WORKFLOW_LIMITS,
  flattenWorkflowConditions,
  toSurveyConditionOperator,
} from "@formbricks/workflows";
import type {
  TWorkflowVariableGroup,
  TWorkflowVariableTypeHint,
} from "@/modules/ee/workflows/lib/variable-picker";
import type {
  TGenericCondition,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import type { TComboboxGroupedOption, TComboboxOption } from "@/modules/ui/components/input-combo-box";

/**
 * The If/else panel on the kit ConditionsEditor (ENG-7182, ADR 0046): workflow conditions
 * (`{left: {path}, operator, right}`) shown as the editor's generic conditions and its edits written
 * back, with the survey operator names. Pure, so the mapping is tested here.
 */

const VARIABLE_OPERAND = "variable";
const STATIC_OPERAND = "static";

const PRESENCE_OPERATORS = new Set<string>(["isSet", "isNotSet", "isEmpty", "isNotEmpty"]);
const LIST_OPERATORS = new Set<string>([
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "doesNotIncludeAllOf",
  "doesNotIncludeOneOf",
]);

export const isPresenceOperator = (operator: string): boolean => PRESENCE_OPERATORS.has(operator);
export const isListOperator = (operator: string): boolean => LIST_OPERATORS.has(operator);

const isGroup = (item: TWorkflowCondition | TWorkflowConditionGroup): item is TWorkflowConditionGroup =>
  "conditions" in item;

const toGenericRight = (right: TWorkflowConditionValue | undefined): TGenericCondition["rightOperand"] => {
  if (right === undefined) return undefined;
  if (Array.isArray(right)) return { value: right, type: STATIC_OPERAND };
  if (right !== null && typeof right === "object") return { value: right.path, type: VARIABLE_OPERAND };
  if (typeof right === "number") return { value: right, type: STATIC_OPERAND };
  return { value: right === null ? "" : String(right), type: STATIC_OPERAND };
};

/**
 * The group as the kit editor draws it. Legacy operator names (ADR 0050) show as the survey operator
 * they mean, so the operator select always finds its option.
 */
export const toGenericConditionGroup = (group: TWorkflowConditionGroup): TGenericConditionGroup => ({
  id: group.id,
  connector: group.connector,
  conditions: group.conditions.map((item) =>
    isGroup(item)
      ? toGenericConditionGroup(item)
      : {
          id: item.id,
          leftOperand: { value: item.left.path, type: VARIABLE_OPERAND },
          operator: toSurveyConditionOperator(item.operator),
          rightOperand: toGenericRight(item.right),
        }
  ),
});

/**
 * A typed value as the condition stores it: a list for the list operators (comma-separated text
 * split), a number or true/false when the Variable is one and the text reads as one, else text.
 */
export const parseConditionValue = (
  value: string | number | string[],
  operator: string,
  typeHint: TWorkflowVariableTypeHint | undefined
): TWorkflowConditionValue => {
  if (isListOperator(operator)) {
    const items = Array.isArray(value) ? value : String(value).split(",");
    return items.map((item) => item.trim()).filter((item) => item !== "");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return value;
  const text = value.trim();
  if (typeHint === "number" && text !== "" && Number.isFinite(Number(text))) return Number(text);
  if (typeHint === "boolean" && (text === "true" || text === "false")) return text === "true";
  return value;
};

/** Writes one condition-row edit from the kit editor back onto the workflow condition. */
export const applyConditionEdit = (
  condition: TWorkflowCondition,
  updates: Partial<TGenericCondition>,
  typeHintOf: (path: string) => TWorkflowVariableTypeHint | undefined
): TWorkflowCondition => {
  const left = updates.leftOperand ? { path: String(updates.leftOperand.value) } : condition.left;
  const operator = (updates.operator ??
    toSurveyConditionOperator(condition.operator)) as TWorkflowCondition["operator"];
  const next: TWorkflowCondition = { id: condition.id, left, operator };

  const rightUpdate = "rightOperand" in updates ? updates.rightOperand : toGenericRight(condition.right);
  if (rightUpdate && !isPresenceOperator(operator)) {
    next.right =
      rightUpdate.type === VARIABLE_OPERAND
        ? { path: String(rightUpdate.value) }
        : parseConditionValue(rightUpdate.value, operator, typeHintOf(left.path));
  }
  return next;
};

const mapGroup = (
  group: TWorkflowConditionGroup,
  map: (items: TWorkflowConditionGroup["conditions"]) => TWorkflowConditionGroup["conditions"]
): TWorkflowConditionGroup => ({
  ...group,
  conditions: map(group.conditions).map((item) => (isGroup(item) ? mapGroup(item, map) : item)),
});

/** Every operation the panel offers on the group, by condition id. */
export const updateConditionInGroup = (
  group: TWorkflowConditionGroup,
  conditionId: string,
  update: (condition: TWorkflowCondition) => TWorkflowCondition
): TWorkflowConditionGroup =>
  mapGroup(group, (items) =>
    items.map((item) => (!isGroup(item) && item.id === conditionId ? update(item) : item))
  );

export const addConditionBelowInGroup = (
  group: TWorkflowConditionGroup,
  conditionId: string,
  created: TWorkflowCondition
): TWorkflowConditionGroup =>
  mapGroup(group, (items) => items.flatMap((item) => (item.id === conditionId ? [item, created] : [item])));

export const duplicateConditionInGroup = (
  group: TWorkflowConditionGroup,
  conditionId: string
): TWorkflowConditionGroup =>
  mapGroup(group, (items) =>
    items.flatMap((item) =>
      item.id === conditionId && !isGroup(item) ? [item, { ...item, id: createId() }] : [item]
    )
  );

/**
 * Removes a condition (or a nested group). An If/else always keeps one condition, so the last one
 * stays; a nested group left empty goes too.
 */
export const removeConditionFromGroup = (
  group: TWorkflowConditionGroup,
  conditionId: string
): TWorkflowConditionGroup => {
  if (flattenWorkflowConditions(group).length <= 1) return group;
  const prune = (current: TWorkflowConditionGroup): TWorkflowConditionGroup => ({
    ...current,
    conditions: current.conditions
      .filter((item) => item.id !== conditionId)
      .map((item) => (isGroup(item) ? prune(item) : item))
      .filter((item) => !isGroup(item) || item.conditions.length > 0),
  });
  return prune(group);
};

export const toggleConnectorInGroup = (
  group: TWorkflowConditionGroup,
  groupId: string
): TWorkflowConditionGroup => {
  const flipped = (connector: TWorkflowConditionGroup["connector"]) => (connector === "and" ? "or" : "and");
  const toggle = (current: TWorkflowConditionGroup): TWorkflowConditionGroup => ({
    ...current,
    connector: current.id === groupId ? flipped(current.connector) : current.connector,
    conditions: current.conditions.map((item) => (isGroup(item) ? toggle(item) : item)),
  });
  return toggle(group);
};

/**
 * The group with every operator under its survey name. The panel writes survey names, and a
 * definition may not mix them with the legacy ones (ADR 0050), so an edit renames the whole group.
 */
export const withSurveyOperatorNames = (group: TWorkflowConditionGroup): TWorkflowConditionGroup =>
  mapGroup(group, (items) =>
    items.map((item) =>
      isGroup(item) ? item : { ...item, operator: toSurveyConditionOperator(item.operator) }
    )
  );

/**
 * The definition with every If/else on survey operator names. Editing one If/else writes survey
 * names, and a definition may not mix the two name sets (ADR 0050), so a second If/else still on
 * legacy names would make the draft unsavable; renaming them all together keeps it valid.
 */
export const withSurveyOperatorNamesInDefinition = <D extends Pick<TWorkflowDefinition, "nodes">>(
  definition: D
): D => ({
  ...definition,
  nodes: definition.nodes.map((node) =>
    node.type === "if_else"
      ? { ...node, config: { ...node.config, condition: withSurveyOperatorNames(node.config.condition) } }
      : node
  ),
});

/** Whether another condition fits (spec §10: 20 per If/else). */
export const canAddCondition = (group: TWorkflowConditionGroup): boolean =>
  flattenWorkflowConditions(group).length < WORKFLOW_LIMITS.maxConditionsPerIfElse;

/** A new condition on the same Variable as the one it follows, waiting for an operator's value. */
export const createConditionLike = (condition: TWorkflowCondition): TWorkflowCondition => ({
  id: createId(),
  left: { path: condition.left.path },
  operator: "isSet",
});

// ---------------------------------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------------------------------

type TOperatorOption = { label: string; value: TWorkflowSurveyConditionOperator };

const equality = (t: TFunction): TOperatorOption[] => [
  { label: t("workspace.surveys.edit.equals"), value: "equals" },
  { label: t("workspace.surveys.edit.does_not_equal"), value: "doesNotEqual" },
];

const presence = (t: TFunction): TOperatorOption[] => [
  { label: t("workspace.surveys.edit.is_set"), value: "isSet" },
  { label: t("workspace.surveys.edit.is_not_set"), value: "isNotSet" },
];

const textOperators = (t: TFunction): TOperatorOption[] => [
  ...equality(t),
  { label: t("workspace.surveys.edit.contains"), value: "contains" },
  { label: t("workspace.surveys.edit.does_not_contain"), value: "doesNotContain" },
  { label: t("workspace.surveys.edit.starts_with"), value: "startsWith" },
  { label: t("workspace.surveys.edit.does_not_start_with"), value: "doesNotStartWith" },
  { label: t("workspace.surveys.edit.ends_with"), value: "endsWith" },
  { label: t("workspace.surveys.edit.does_not_end_with"), value: "doesNotEndWith" },
  { label: t("workspace.surveys.edit.equals_one_of"), value: "equalsOneOf" },
  { label: t("workspace.surveys.edit.is_before"), value: "isBefore" },
  { label: t("workspace.surveys.edit.is_after"), value: "isAfter" },
  { label: t("workspace.surveys.edit.is_empty"), value: "isEmpty" },
  { label: t("workspace.surveys.edit.is_not_empty"), value: "isNotEmpty" },
  ...presence(t),
];

const numberOperators = (t: TFunction): TOperatorOption[] => [
  { label: "=", value: "equals" },
  { label: "!=", value: "doesNotEqual" },
  { label: ">", value: "isGreaterThan" },
  { label: "<", value: "isLessThan" },
  { label: ">=", value: "isGreaterThanOrEqual" },
  { label: "<=", value: "isLessThanOrEqual" },
  ...presence(t),
];

const listOperators = (t: TFunction): TOperatorOption[] => [
  { label: t("workspace.surveys.edit.includes_all_of"), value: "includesAllOf" },
  { label: t("workspace.surveys.edit.includes_one_of"), value: "includesOneOf" },
  { label: t("workspace.surveys.edit.does_not_include_all_of"), value: "doesNotIncludeAllOf" },
  { label: t("workspace.surveys.edit.does_not_include_one_of"), value: "doesNotIncludeOneOf" },
  { label: t("workspace.surveys.edit.is_empty"), value: "isEmpty" },
  { label: t("workspace.surveys.edit.is_not_empty"), value: "isNotEmpty" },
  ...presence(t),
];

/** The operators a Variable of this type offers, survey logic's families for the same kinds. */
export const getConditionOperatorOptions = (
  typeHint: TWorkflowVariableTypeHint | undefined,
  t: TFunction
): TComboboxOption[] => {
  switch (typeHint) {
    case "number":
      return numberOperators(t);
    case "boolean":
      return [...equality(t), ...presence(t)];
    case "list":
      return listOperators(t);
    case "object":
    case "empty":
      return presence(t);
    case "text":
      return textOperators(t);
    default: {
      // A Variable the groups don't know (no sample, a removed question): every operator, so the
      // stored one always has its option.
      const seen = new Set<string>();
      return [...textOperators(t), ...numberOperators(t), ...listOperators(t)].filter((option) => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
    }
  }
};

const GROUP_LABEL_KEYS = {
  payload: "workspace.workflows.variable_group_payload",
  response: "workspace.workflows.variable_group_response",
} as const;

/**
 * The Variable picker's groups as the editor's grouped options: what a condition can compare, and
 * what its value can be instead of typed text. A path the groups no longer offer (the sample changed)
 * stays listed under its own name, so the condition still shows what it compares.
 */
export const toVariableComboboxGroups = (
  groups: readonly TWorkflowVariableGroup[],
  t: TFunction,
  stepGroupLabel: (group: Extract<TWorkflowVariableGroup, { kind: "step" }>) => string
): TComboboxGroupedOption[] =>
  groups
    .map((group) => ({
      label: group.kind === "step" ? stepGroupLabel(group) : t(GROUP_LABEL_KEYS[group.kind]),
      value: group.kind === "step" ? `step:${group.stepId}` : group.kind,
      options: group.options.map((option) => ({
        label: option.label,
        value: option.path,
        disabled: !option.isPickable,
        meta: { type: VARIABLE_OPERAND },
      })),
    }))
    .filter((group) => group.options.length > 0);

/** The type hint of each path the groups offer, for operators and value parsing. */
export const getTypeHintLookup =
  (groups: readonly TWorkflowVariableGroup[]) =>
  (path: string): TWorkflowVariableTypeHint | undefined =>
    groups.flatMap((group) => group.options).find((option) => option.path === path)?.typeHint;
