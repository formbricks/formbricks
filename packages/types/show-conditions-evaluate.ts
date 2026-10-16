// Type-only imports on purpose: js-core bundles this file, and a value import from
// `./show-conditions` would pull zod into every visitor's SDK.
import type {
  TDeviceInfo,
  TShowConditionGroup,
  TShowConditionSingle,
  TShowConditions,
  TVisitSnapshot,
} from "./show-conditions";

export interface TShowConditionsContext {
  /** The full current URL, query string included. */
  url: string;
  /** The current page's `document.referrer`. */
  pageReferrer: string;
  /** `null` when the visit store is unavailable, e.g. storage is blocked. */
  visit: TVisitSnapshot | null;
  device: TDeviceInfo;
}

export interface TShowConditionResult {
  conditionId: string;
  actual: unknown;
  passed: boolean;
}

export interface TShowConditionsEvaluation {
  passed: boolean;
  results: TShowConditionResult[];
}

export const isShowConditionGroup = (
  item: TShowConditionSingle | TShowConditionGroup
): item is TShowConditionGroup => "conditions" in item;

type TResolvedOperand =
  | { kind: "text"; actual: string | string[]; values: string[] }
  | { kind: "number"; actual: number }
  | { kind: "missing" };

const MISSING: TResolvedOperand = { kind: "missing" };

const text = (value: string): TResolvedOperand => ({ kind: "text", actual: value, values: [value] });
const textList = (values: string[]): TResolvedOperand => ({ kind: "text", actual: values, values });
const numeric = (value: number): TResolvedOperand => ({ kind: "number", actual: value });

const getQueryParamValues = (url: string, key: string): string[] => {
  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    return [];
  }
  const wanted = key.toLowerCase();
  const values: string[] = [];
  params.forEach((value, name) => {
    if (name.toLowerCase() === wanted) values.push(value);
  });
  return values;
};

// Every visit operand, `entryReferrer` included, reads from the visit store. Without it there is
// nothing to compare, so these conditions fail whatever the operator.
const resolveVisitOperand = (operand: string, visit: TVisitSnapshot | null): TResolvedOperand => {
  if (!visit) return MISSING;
  switch (operand) {
    case "entryReferrer":
      return text(visit.entryReferrer);
    case "visitedUrls":
      return textList(visit.visitedUrls);
    case "pagesViewed":
      return numeric(visit.pagesViewed);
    case "uniquePagesViewed":
      return numeric(visit.uniquePagesViewed);
    case "timeOnSite":
      return numeric(visit.timeOnSite);
    default:
      return MISSING;
  }
};

const resolveOperand = (
  condition: TShowConditionSingle,
  context: TShowConditionsContext
): TResolvedOperand => {
  switch (condition.leftOperand.value) {
    case "currentUrl":
      return text(context.url);
    case "pageReferrer":
      return text(context.pageReferrer);
    case "queryParam":
      return textList(getQueryParamValues(context.url, condition.leftOperand.meta?.key ?? ""));
    case "deviceType":
      return text(context.device.deviceType);
    case "browser":
      return text(context.device.browser);
    case "screenWidth":
      return numeric(context.device.screenWidth);
    default:
      return resolveVisitOperand(condition.leftOperand.value, context.visit);
  }
};

const NEGATED_OPERATORS = new Map([
  ["doesNotEqual", "equals"],
  ["doesNotContain", "contains"],
  ["containsNoneOf", "containsAnyOf"],
  ["doesNotInclude", "includes"],
]);

const getTextMatcher = (operator: string, expected: unknown): ((value: string) => boolean) | undefined => {
  if (operator === "containsAnyOf") {
    if (!Array.isArray(expected) || !expected.every((entry) => typeof entry === "string")) return undefined;
    const fragments = expected.map((fragment: string) => fragment.toLowerCase());
    return (value) => fragments.some((fragment) => value.includes(fragment));
  }
  if (typeof expected !== "string") return undefined;
  const target = expected.toLowerCase();
  switch (operator) {
    case "equals":
      return (value) => value === target;
    case "contains":
    case "includes":
      return (value) => value.includes(target);
    case "startsWith":
      return (value) => value.startsWith(target);
    case "endsWith":
      return (value) => value.endsWith(target);
    default:
      return undefined;
  }
};

// Some text operands carry several values (a repeated query parameter, the visited URLs). A
// positive operator passes when any value matches; a negated one passes when none does — so an
// absent query parameter passes "does not equal" and fails "equals".
const evaluateText = (values: string[], operator: string, expected: unknown): boolean => {
  // Presence ignores the value, so `?source=` counts as set.
  if (operator === "isSet") return values.length > 0;
  if (operator === "isNotSet") return values.length === 0;

  const positiveOperator = NEGATED_OPERATORS.get(operator) ?? operator;
  const matches = getTextMatcher(positiveOperator, expected);
  if (!matches) return false;
  const anyMatches = values.some((value) => matches(value.toLowerCase()));
  return positiveOperator === operator ? anyMatches : !anyMatches;
};

const evaluateNumber = (actual: number, operator: string, expected: unknown): boolean => {
  if (typeof expected !== "number") return false;
  switch (operator) {
    case "equals":
      return actual === expected;
    case "isGreaterThan":
      return actual > expected;
    case "isLessThan":
      return actual < expected;
    case "isGreaterThanOrEqual":
      return actual >= expected;
    case "isLessThanOrEqual":
      return actual <= expected;
    default:
      return false;
  }
};

const evaluateCondition = (
  condition: TShowConditionSingle,
  context: TShowConditionsContext,
  results: TShowConditionResult[]
): boolean => {
  const resolved = resolveOperand(condition, context);
  const expected = condition.rightOperand?.value;

  let passed = false;
  if (resolved.kind === "text") passed = evaluateText(resolved.values, condition.operator, expected);
  if (resolved.kind === "number") passed = evaluateNumber(resolved.actual, condition.operator, expected);

  results.push({
    conditionId: condition.id,
    actual: resolved.kind === "missing" ? null : resolved.actual,
    passed,
  });
  return passed;
};

const evaluateGroup = (
  group: TShowConditionGroup,
  context: TShowConditionsContext,
  results: TShowConditionResult[]
): boolean => {
  // Same as `null`: an empty group restricts nothing. The schema already prunes these.
  if (group.conditions.length === 0) return true;

  // `map`, not `some`/`every`: every condition runs, so the caller gets a result for each one.
  const outcomes = group.conditions.map((item) =>
    isShowConditionGroup(item)
      ? evaluateGroup(item, context, results)
      : evaluateCondition(item, context, results)
  );
  return group.connector === "or" ? outcomes.some(Boolean) : outcomes.every(Boolean);
};

/**
 * Decides whether a target's show conditions hold, and reports the outcome of every condition.
 *
 * Pure: the caller reads the URL, visit and device and passes them in. Text matching ignores case.
 * js-core's `checkUrlMatch` stays case-sensitive on purpose, so existing action page filters behave
 * as before. Anything the evaluator cannot read or compare (a blocked visit store, an operator that
 * does not fit the operand) fails that condition rather than passing it.
 */
export const evaluateShowConditions = (
  conditions: TShowConditions,
  context: TShowConditionsContext
): TShowConditionsEvaluation => {
  if (!conditions) return { passed: true, results: [] };

  const results: TShowConditionResult[] = [];
  const passed = evaluateGroup(conditions, context, results);
  return { passed, results };
};
