import {
  SHOW_CONDITION_OPERANDS,
  SHOW_CONDITION_OPERATORS,
  type TShowConditionGroup,
  type TShowConditionOperand,
  type TShowConditionOperandType,
  type TShowConditionOperator,
  type TShowConditionSingle,
  type TShowConditions,
} from "@formbricks/types/show-conditions";
import { evaluateShowConditions, isShowConditionGroup } from "@formbricks/types/show-conditions-evaluate";

// Editor-side helpers over the shared Trigger Logic schema (PR #9618). The real card ships with
// ENG-3927; this keeps the prototype on the same schema so nothing here needs translating later.

export type TConditionValueKind = "none" | "text" | "list" | "number" | "deviceType" | "browser";

const LIST_OPERATORS = new Set<TShowConditionOperator>(["containsAnyOf", "containsNoneOf"]);
const PRESENCE_OPERATORS = new Set<TShowConditionOperator>(["isSet", "isNotSet"]);
const NUMBER_OPERANDS = new Set<TShowConditionOperand>([
  "pagesViewed",
  "uniquePagesViewed",
  "timeOnSite",
  "screenWidth",
]);
const VISIT_OPERANDS = new Set<TShowConditionOperand>(SHOW_CONDITION_OPERANDS.visit);

export const getOperandType = (operand: TShowConditionOperand): TShowConditionOperandType =>
  (Object.keys(SHOW_CONDITION_OPERANDS) as TShowConditionOperandType[]).find((type) =>
    (SHOW_CONDITION_OPERANDS[type] as readonly string[]).includes(operand)
  ) ?? "page";

export const getOperators = (operand: TShowConditionOperand): readonly TShowConditionOperator[] =>
  SHOW_CONDITION_OPERATORS[operand];

export const getValueKind = (
  operand: TShowConditionOperand,
  operator: TShowConditionOperator
): TConditionValueKind => {
  if (PRESENCE_OPERATORS.has(operator)) return "none";
  if (operand === "deviceType") return "deviceType";
  if (operand === "browser") return "browser";
  if (NUMBER_OPERANDS.has(operand)) return "number";
  if (LIST_OPERATORS.has(operator)) return "list";
  return "text";
};

const defaultRightOperand = (kind: TConditionValueKind): TShowConditionSingle["rightOperand"] => {
  if (kind === "none") return undefined;
  if (kind === "number") return { type: "static", value: 0 };
  if (kind === "list") return { type: "static", value: [] };
  if (kind === "deviceType") return { type: "static", value: "desktop" };
  if (kind === "browser") return { type: "static", value: "chrome" };
  return { type: "static", value: "" };
};

/** A condition on `operand` with its first operator and an empty value of the matching kind. */
export const createCondition = (operand: TShowConditionOperand, id: string): TShowConditionSingle => {
  const operator = getOperators(operand)[0];
  return {
    id,
    leftOperand: {
      type: getOperandType(operand),
      value: operand,
      ...(operand === "queryParam" ? { meta: { key: "" } } : {}),
    },
    operator,
    rightOperand: defaultRightOperand(getValueKind(operand, operator)),
  };
};

/** Changing the operator keeps the value when its kind still fits, and resets it otherwise. */
export const withOperator = (
  condition: TShowConditionSingle,
  operator: TShowConditionOperator
): TShowConditionSingle => {
  const operand = condition.leftOperand.value;
  const sameKind = getValueKind(operand, operator) === getValueKind(operand, condition.operator);
  return {
    ...condition,
    operator,
    rightOperand: sameKind ? condition.rightOperand : defaultRightOperand(getValueKind(operand, operator)),
  };
};

export const isConditionComplete = (condition: TShowConditionSingle): boolean => {
  if (condition.leftOperand.value === "queryParam" && !condition.leftOperand.meta?.key.trim()) return false;
  const kind = getValueKind(condition.leftOperand.value, condition.operator);
  if (kind === "none") return true;
  const value = condition.rightOperand?.value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "";
};

/** The editor shows one flat group; nested groups (depth 2) are kept but not edited here. */
export const getTopLevelConditions = (conditions: TShowConditions): TShowConditionSingle[] =>
  conditions
    ? conditions.conditions.filter((item): item is TShowConditionSingle => !isShowConditionGroup(item))
    : [];

export const hasIncompleteConditions = (conditions: TShowConditions): boolean =>
  getTopLevelConditions(conditions).some((condition) => !isConditionComplete(condition));

/** Writes the flat list back, pruning an empty group to null like the schema does. */
export const setTopLevelConditions = (
  current: TShowConditions,
  singles: TShowConditionSingle[],
  groupId: string
): TShowConditions => {
  const nested = current ? current.conditions.filter(isShowConditionGroup) : [];
  const conditions: TShowConditionGroup["conditions"] = [...singles, ...nested];
  if (conditions.length === 0) return null;
  return { id: current?.id ?? groupId, connector: current?.connector ?? "and", conditions };
};

export interface TUrlTestResult {
  passed: boolean;
  /** Per condition: true/false, or null when a visit condition can't be judged from a URL alone. */
  byCondition: Record<string, boolean | null>;
}

/** "Test your URL": runs the real evaluator against a typed URL on a desktop browser, no visit. */
export const testUrl = (conditions: TShowConditions, url: string): TUrlTestResult => {
  const evaluation = evaluateShowConditions(conditions, {
    url,
    pageReferrer: "",
    visit: null,
    device: { deviceType: "desktop", browser: "chrome", screenWidth: 1440 },
  });
  const visitConditionIds = new Set(
    getTopLevelConditions(conditions)
      .filter((condition) => VISIT_OPERANDS.has(condition.leftOperand.value))
      .map((condition) => condition.id)
  );
  const byCondition: Record<string, boolean | null> = {};
  for (const result of evaluation.results) {
    byCondition[result.conditionId] = visitConditionIds.has(result.conditionId) ? null : result.passed;
  }
  return { passed: evaluation.passed, byCondition };
};
