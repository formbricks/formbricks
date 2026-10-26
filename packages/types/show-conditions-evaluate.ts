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

export interface TShowConditionGroupResult {
  groupId: string;
  connector: TShowConditionGroup["connector"];
  passed: boolean;
}

export interface TShowConditionsEvaluation {
  passed: boolean;
  results: TShowConditionResult[];
  /**
   * Each group's own outcome, the outermost last. A condition that failed inside an "any" group
   * that passed decided nothing, and only the group's outcome says so (ENG-4070).
   */
  groups: TShowConditionGroupResult[];
}

export const isShowConditionGroup = (
  item: TShowConditionSingle | TShowConditionGroup
): item is TShowConditionGroup => "conditions" in item;

type TResolvedOperand =
  | { kind: "text"; actual: string | string[]; values: string[] }
  | { kind: "queryParam"; actual: string[]; values: string[] }
  | { kind: "path"; actual: string }
  | { kind: "visited"; actual: string[] }
  | { kind: "number"; actual: number }
  | { kind: "missing" };

/**
 * How many different pages the visit store remembers. Unique pages viewed stops counting here and
 * Visited URL sees this many, so a condition cannot ask for more.
 */
export const MAX_UNIQUE_PAGES = 200;

const PATH_OPERATORS: ReadonlySet<string> = new Set(["pathIsAnyOf", "pathIsNoneOf"]);

/**
 * The page path that exact comparisons use: lowercase, no trailing slash, no query string or #hash.
 * A full URL is reduced to its path, so a line pasted from the address bar matches its page too. The
 * visit store keeps its paths in this form, so `/plans/` and `/Plans` count as one page.
 */
export const normalizeUrlPath = (value: string): string => {
  let path = value.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Not a parseable URL: compare what was typed.
    }
  }
  path = path.split(/[?#]/, 1)[0];
  try {
    path = decodeURI(path);
  } catch {
    // A stray "%" that is not an escape: keep the raw text.
  }
  if (!path.startsWith("/")) path = `/${path}`;
  // A loop, not `/\/+$/`: that regex backtracks on a long run of "/" that does not end the path.
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  path = path.slice(0, end) || "/";
  return path.toLowerCase();
};

const MISSING: TResolvedOperand = { kind: "missing" };

const text = (value: string): TResolvedOperand => ({ kind: "text", actual: value, values: [value] });
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
      return { kind: "visited", actual: visit.uniquePaths };
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
      return PATH_OPERATORS.has(condition.operator)
        ? { kind: "path", actual: normalizeUrlPath(context.url) }
        : text(context.url);
    case "pageReferrer":
      return text(context.pageReferrer);
    case "queryParam": {
      const key = condition.leftOperand.meta?.key;
      if (!key) return MISSING;
      const values = getQueryParamValues(context.url, key);
      return { kind: "queryParam", actual: values, values };
    }
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
      return (value) => value.includes(target);
    case "startsWith":
      return (value) => value.startsWith(target);
    case "endsWith":
      return (value) => value.endsWith(target);
    default:
      return undefined;
  }
};

// A repeated query parameter carries several values. A positive operator passes when any value
// matches; a negated one passes when none does — so an absent query parameter passes "does not
// equal" and fails "equals".
const evaluateText = (values: string[], operator: string, expected: unknown): boolean => {
  const positiveOperator = NEGATED_OPERATORS.get(operator) ?? operator;
  const matches = getTextMatcher(positiveOperator, expected);
  if (!matches) return false;
  const anyMatches = values.some((value) => matches(value.toLowerCase()));
  return positiveOperator === operator ? anyMatches : !anyMatches;
};

// A query parameter is the only operand that can be absent, so only it answers `isSet` / `isNotSet`.
// Presence ignores the value: `?source=` counts as set.
const evaluateQueryParam = (values: string[], operator: string, expected: unknown): boolean => {
  if (operator !== "isSet" && operator !== "isNotSet") return evaluateText(values, operator, expected);
  if (expected !== undefined) return false;
  return operator === "isSet" ? values.length > 0 : values.length === 0;
};

// Exact page paths: `/blog/planning` matches only that page, not `/blog/planning-for-retirement`.
const evaluatePathList = (path: string, operator: string, expected: unknown): boolean => {
  if (!Array.isArray(expected) || !expected.every((entry) => typeof entry === "string")) return false;
  const isListed = expected.some((entry: string) => normalizeUrlPath(entry) === path);
  return operator === "pathIsAnyOf" ? isListed : !isListed;
};

// One exact page, like the path lists: `/pricing` is not `/pricing/compare` or `/blog/pricing-tips`.
const evaluateVisited = (paths: string[], operator: string, expected: unknown): boolean => {
  if (typeof expected !== "string" || expected.trim() === "") return false;
  const target = normalizeUrlPath(expected);
  // The visit store records paths already normalized; normalizing again would decode `%25` twice.
  const visited = paths.includes(target);
  if (operator === "includes") return visited;
  return operator === "doesNotInclude" ? !visited : false;
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
  if (resolved.kind === "queryParam") {
    passed = evaluateQueryParam(resolved.values, condition.operator, expected);
  }
  if (resolved.kind === "path") passed = evaluatePathList(resolved.actual, condition.operator, expected);
  if (resolved.kind === "visited") passed = evaluateVisited(resolved.actual, condition.operator, expected);
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
  results: TShowConditionResult[],
  groups: TShowConditionGroupResult[]
): boolean => {
  // `map`, not `some`/`every`: every condition runs, so the caller gets a result for each one.
  const outcomes = group.conditions.map((item) =>
    isShowConditionGroup(item)
      ? evaluateGroup(item, context, results, groups)
      : evaluateCondition(item, context, results)
  );
  // An empty group restricts nothing, the same as `null`. The schema already prunes these.
  const passed =
    outcomes.length === 0 || (group.connector === "or" ? outcomes.some(Boolean) : outcomes.every(Boolean));
  groups.push({ groupId: group.id, connector: group.connector, passed });
  return passed;
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
  if (!conditions) return { passed: true, results: [], groups: [] };

  const results: TShowConditionResult[] = [];
  const groups: TShowConditionGroupResult[] = [];
  const passed = evaluateGroup(conditions, context, results, groups);
  return { passed, results, groups };
};
