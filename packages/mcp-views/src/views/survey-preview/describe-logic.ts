import type { JsonRecord } from "./types";

/**
 * Block logic in plain words: "If Question 2 equals Yes, jump to block 4." Everything the sentence names
 * is looked up in a `LogicContext` built once from the survey, so a reference to a question, block or
 * variable reads as what the person sees in the outline rather than as an id.
 */
export interface LogicContext {
  languageCode: string;
  defaultLanguage: string;
  /** Element id to its number and choices, for "Question 2" and for choice ids in a comparison. */
  elements: Map<string, { number: number; choices: Map<string, string> }>;
  /** Block id to its position and name. */
  blocks: Map<string, { number: number; name: string }>;
  /** Ending id to its position. */
  endings: Map<string, number>;
  variables: Map<string, string>;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const OPERATOR_WORDS: Record<string, string> = {
  equals: "equals",
  doesNotEqual: "does not equal",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  doesNotStartWith: "does not start with",
  endsWith: "ends with",
  doesNotEndWith: "does not end with",
  isSubmitted: "is answered",
  isSkipped: "is skipped",
  isGreaterThan: "is greater than",
  isLessThan: "is less than",
  isGreaterThanOrEqual: "is at least",
  isLessThanOrEqual: "is at most",
  equalsOneOf: "is one of",
  includesAllOf: "includes all of",
  includesOneOf: "includes one of",
  doesNotIncludeOneOf: "includes none of",
  doesNotIncludeAllOf: "does not include all of",
  isClicked: "is clicked",
  isNotClicked: "is not clicked",
  isAccepted: "is accepted",
  isBefore: "is before",
  isAfter: "is after",
  isBooked: "is booked",
  isPartiallySubmitted: "is partially answered",
  isCompletelySubmitted: "is completely answered",
  isSet: "is set",
  isNotSet: "is not set",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  isAnyOf: "is any of",
};

export const describeOperand = (
  operand: unknown,
  context: LogicContext,
  leftElementId?: string
): string => {
  if (!isRecord(operand)) return "?";
  const { type, value } = operand;

  if (type === "static") {
    const choices = leftElementId ? context.elements.get(leftElementId)?.choices : undefined;
    const label = (entry: unknown) => (typeof entry === "string" ? (choices?.get(entry) ?? entry) : String(entry));
    return Array.isArray(value) ? value.map(label).join(", ") : `"${label(value)}"`;
  }
  if (typeof value !== "string") return "?";
  if (type === "element" || type === "question") {
    const element = context.elements.get(value);
    return element ? `Question ${element.number}` : "a removed question";
  }
  if (type === "variable") return `variable ${context.variables.get(value) ?? "(removed)"}`;
  if (type === "hiddenField") return `hidden field ${value}`;
  if (type === "reserved") return value;
  return "?";
};

const describeCondition = (condition: JsonRecord, context: LogicContext): string => {
  const left = condition.leftOperand;
  const leftElementId = isRecord(left) && left.type === "element" && typeof left.value === "string" ? left.value : undefined;
  const operator = typeof condition.operator === "string" ? condition.operator : "";
  const words = OPERATOR_WORDS[operator] ?? operator;
  const right = condition.rightOperand === undefined ? "" : ` ${describeOperand(condition.rightOperand, context, leftElementId)}`;
  return `${describeOperand(left, context)} ${words}${right}`;
};

/** A condition group, joined by its connector; a nested group is parenthesised. */
export const describeConditionGroup = (group: unknown, context: LogicContext, nested = false): string => {
  if (!isRecord(group) || !Array.isArray(group.conditions)) return "";
  const connector = group.connector === "or" ? " or " : " and ";
  const parts = group.conditions.filter(isRecord).map((entry) =>
    Array.isArray(entry.conditions) ? describeConditionGroup(entry, context, true) : describeCondition(entry, context)
  );
  const joined = parts.filter(Boolean).join(connector);
  return nested && parts.length > 1 ? `(${joined})` : joined;
};

const describeTarget = (targetId: unknown, context: LogicContext): string => {
  if (typeof targetId !== "string") return "a block";
  const block = context.blocks.get(targetId);
  if (block) return `block ${block.number}${block.name ? ` (${block.name})` : ""}`;
  const ending = context.endings.get(targetId);
  if (ending !== undefined) return `ending ${ending}`;
  return "a removed block";
};

const describeAction = (action: JsonRecord, context: LogicContext): string => {
  if (action.objective === "jumpToBlock") return `jump to ${describeTarget(action.target, context)}`;
  if (action.objective === "requireAnswer") {
    const element = typeof action.target === "string" ? context.elements.get(action.target) : undefined;
    return `require ${element ? `Question ${element.number}` : "a question"}`;
  }
  if (action.objective === "calculate") {
    const variable =
      typeof action.variableId === "string" ? (context.variables.get(action.variableId) ?? "(removed)") : "?";
    const value = describeOperand(action.value, context);
    switch (action.operator) {
      case "assign":
        return `set variable ${variable} to ${value}`;
      case "concat":
        return `append ${value} to variable ${variable}`;
      case "add":
        return `add ${value} to variable ${variable}`;
      case "subtract":
        return `subtract ${value} from variable ${variable}`;
      case "multiply":
        return `multiply variable ${variable} by ${value}`;
      case "divide":
        return `divide variable ${variable} by ${value}`;
      default:
        return `change variable ${variable}`;
    }
  }
  return "do something";
};

const capitalize = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** One sentence per logic rule of a block. */
export const describeBlockLogic = (logic: unknown, context: LogicContext): string[] => {
  if (!Array.isArray(logic)) return [];
  return logic.filter(isRecord).map((rule) => {
    const condition = describeConditionGroup(rule.conditions, context);
    const actions = (Array.isArray(rule.actions) ? rule.actions : [])
      .filter(isRecord)
      .map((action) => describeAction(action, context));
    return `${capitalize(`if ${condition || "always"}`)}, ${actions.join(" and ") || "do nothing"}.`;
  });
};

export const describeFallback = (target: unknown, context: LogicContext): string | undefined =>
  typeof target === "string" ? `Otherwise, jump to ${describeTarget(target, context)}.` : undefined;
