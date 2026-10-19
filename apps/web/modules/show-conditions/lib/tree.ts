import { createId } from "@paralleldrive/cuid2";
import {
  SHOW_CONDITIONS_LIMITS,
  SHOW_CONDITION_OPERANDS,
  SHOW_CONDITION_OPERATORS,
  type TShowConditionGroup,
  type TShowConditionOperand,
  type TShowConditionOperandType,
  type TShowConditionOperator,
  type TShowConditionSingle,
  type TShowConditions,
} from "@formbricks/types/show-conditions";
import { isShowConditionGroup } from "@formbricks/types/show-conditions-evaluate";

/**
 * Edits to a show-conditions tree, shaped for the shared `ConditionsEditor` callbacks. Every helper
 * returns a new tree and never mutates its input, so React state updates stay plain. Survey-agnostic:
 * Creatives edit their conditions with the same helpers (ENG-3575).
 */

type TItem = TShowConditionSingle | TShowConditionGroup;

/** What a new condition on each operand starts with: the comparison people reach for first. */
export const DEFAULT_OPERATOR_BY_OPERAND: Record<TShowConditionOperand, TShowConditionOperator> = {
  currentUrl: "pathIsAnyOf",
  pageReferrer: "contains",
  entryReferrer: "contains",
  queryParam: "equals",
  pagesViewed: "isGreaterThanOrEqual",
  uniquePagesViewed: "isGreaterThanOrEqual",
  timeOnSite: "isGreaterThanOrEqual",
  visitedUrls: "includes",
  deviceType: "equals",
  browser: "equals",
  screenWidth: "isGreaterThanOrEqual",
};

const OPERAND_TYPE_BY_OPERAND = new Map<string, TShowConditionOperandType>(
  Object.entries(SHOW_CONDITION_OPERANDS).flatMap(([type, operands]) =>
    operands.map((operand) => [operand, type as TShowConditionOperandType] as const)
  )
);

const OPERATORS_BY_OPERAND = new Map<string, ReadonlySet<string>>(
  Object.entries(SHOW_CONDITION_OPERATORS).map(([operand, operators]) => [operand, new Set(operators)])
);

export const isShowConditionOperand = (value: string): value is TShowConditionOperand =>
  OPERAND_TYPE_BY_OPERAND.has(value);

export const createShowCondition = (operand: TShowConditionOperand = "currentUrl"): TShowConditionSingle => ({
  id: createId(),
  leftOperand: {
    type: OPERAND_TYPE_BY_OPERAND.get(operand) ?? "page",
    value: operand,
    ...(operand === "queryParam" && { meta: { key: "" } }),
  },
  operator: DEFAULT_OPERATOR_BY_OPERAND[operand],
});

/** Adds a condition at the end of the top-level group, starting the tree when there is none. */
export const appendShowCondition = (root: TShowConditions): TShowConditionGroup =>
  root
    ? { ...root, conditions: [...root.conditions, createShowCondition()] }
    : { id: createId(), connector: "and", conditions: [createShowCondition()] };

const mapChildGroups = (
  group: TShowConditionGroup,
  map: (child: TShowConditionGroup) => TShowConditionGroup
): TShowConditionGroup => ({
  ...group,
  conditions: group.conditions.map((item) => (isShowConditionGroup(item) ? map(item) : item)),
});

const insertAfter = (group: TShowConditionGroup, id: string, item: TItem): TShowConditionGroup => {
  const index = group.conditions.findIndex((existing) => existing.id === id);
  if (index === -1) return mapChildGroups(group, (child) => insertAfter(child, id, item));

  const conditions = [...group.conditions];
  conditions.splice(index + 1, 0, item);
  return { ...group, conditions };
};

export const addShowConditionBelow = (root: TShowConditionGroup, id: string): TShowConditionGroup =>
  insertAfter(root, id, createShowCondition());

const findItem = (group: TShowConditionGroup, id: string): TItem | undefined => {
  for (const item of group.conditions) {
    if (item.id === id) return item;
    if (isShowConditionGroup(item)) {
      const found = findItem(item, id);
      if (found) return found;
    }
  }
  return undefined;
};

const withNewIds = (item: TItem): TItem =>
  isShowConditionGroup(item)
    ? { ...item, id: createId(), conditions: item.conditions.map(withNewIds) }
    : { ...structuredClone(item), id: createId() };

export const duplicateShowCondition = (root: TShowConditionGroup, id: string): TShowConditionGroup => {
  const item = findItem(root, id);
  return item ? insertAfter(root, id, withNewIds(item)) : root;
};

const removeItem = (group: TShowConditionGroup, id: string): TShowConditionGroup => ({
  ...group,
  conditions: group.conditions
    .filter((item) => item.id !== id)
    .map((item) => (isShowConditionGroup(item) ? removeItem(item, id) : item))
    .filter((item) => !isShowConditionGroup(item) || item.conditions.length > 0),
});

/**
 * Removes a condition or group. Empty groups go with it, a top level left holding just one group
 * takes that group's place (as survey logic does), and an empty tree becomes `null`: no conditions.
 */
export const removeShowCondition = (root: TShowConditionGroup, id: string): TShowConditions => {
  const next = removeItem(root, id);
  if (next.conditions.length === 0) return null;

  const [onlyItem] = next.conditions;
  if (next.conditions.length === 1 && isShowConditionGroup(onlyItem)) return { ...onlyItem, id: next.id };
  return next;
};

/** Only the top level can hold a group, so a group never sits inside another (`maxDepth` is 2). */
export const canCreateShowConditionGroup = (editorDepth: number): boolean =>
  editorDepth < SHOW_CONDITIONS_LIMITS.maxDepth - 1;

/** Wraps a condition in a new group of its own, which the next "add condition below" fills. */
export const createShowConditionGroup = (root: TShowConditionGroup, id: string): TShowConditionGroup => ({
  ...root,
  conditions: root.conditions.map((item) =>
    item.id === id && !isShowConditionGroup(item)
      ? { id: createId(), connector: "and", conditions: [item] }
      : item
  ),
});

export const toggleShowConditionConnector = (
  group: TShowConditionGroup,
  groupId: string
): TShowConditionGroup =>
  group.id === groupId
    ? { ...group, connector: group.connector === "and" ? "or" : "and" }
    : mapChildGroups(group, (child) => toggleShowConditionConnector(child, groupId));

/** The parts of a condition the shared editor sends back on change. */
export interface TShowConditionUpdate {
  leftOperand?: { value: string; type?: string; meta?: Record<string, unknown> };
  operator?: string;
  rightOperand?: { value: string | number | string[]; type?: string };
}

/**
 * Applies an editor change and keeps the condition valid. A new operand gets its own default
 * comparison and an empty value (the editor resets both, but not to anything this schema accepts),
 * and only a query parameter keeps `meta`, where its name lives.
 */
const applyUpdate = (condition: TShowConditionSingle, update: TShowConditionUpdate): TShowConditionSingle => {
  const next: TShowConditionSingle = { ...condition };

  const operand = update.leftOperand?.value;
  if (operand !== undefined && operand !== condition.leftOperand.value && isShowConditionOperand(operand)) {
    return { ...createShowCondition(operand), id: condition.id };
  }

  if (update.leftOperand?.meta && condition.leftOperand.value === "queryParam") {
    const { key } = update.leftOperand.meta;
    next.leftOperand = { ...condition.leftOperand, meta: { key: typeof key === "string" ? key : "" } };
  }

  if (
    update.operator !== undefined &&
    OPERATORS_BY_OPERAND.get(condition.leftOperand.value)?.has(update.operator)
  ) {
    next.operator = update.operator as TShowConditionOperator;
  }

  if ("rightOperand" in update) {
    next.rightOperand = update.rightOperand
      ? { type: "static", value: update.rightOperand.value }
      : undefined;
    if (!next.rightOperand) delete next.rightOperand;
  }

  return next;
};

export const updateShowCondition = (
  group: TShowConditionGroup,
  id: string,
  update: TShowConditionUpdate
): TShowConditionGroup => ({
  ...group,
  conditions: group.conditions.map((item) => {
    if (isShowConditionGroup(item)) return updateShowCondition(item, id, update);
    return item.id === id ? applyUpdate(item, update) : item;
  }),
});

/** Every single condition in the tree, in reading order. */
export const listShowConditions = (root: TShowConditions): TShowConditionSingle[] =>
  root
    ? root.conditions.flatMap((item) => (isShowConditionGroup(item) ? listShowConditions(item) : [item]))
    : [];
