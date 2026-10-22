import type {
  TShowConditionGroup,
  TShowConditionSingle,
  TShowConditions,
} from "@formbricks/types/show-conditions";
import {
  type TShowConditionGroupResult,
  type TShowConditionResult,
  isShowConditionGroup,
} from "@formbricks/types/show-conditions-evaluate";
import type { TDebugSurveyEvent } from "@/types/debug";

/**
 * Text for the debug panel. English only: it is a developer tool shown on the customer's own site,
 * where the SDK has no translations, and its readers are the people setting the survey up.
 */

const EXCLUSION_TEXT: Record<NonNullable<TDebugSurveyEvent["exclusion"]>, string> = {
  alreadyDisplayed: "already shown to this visitor (show only once)",
  alreadyResponded: "this visitor already responded",
  displayLimitReached: "shown as many times as allowed",
  cooldown: "inside the cooldown period after the last survey",
  segment: "this visitor is not in the survey's segment",
};

export const describeOutcome = (event: TDebugSurveyEvent): string => {
  const isRecheck = event.stage === "beforeShow";
  switch (event.outcome) {
    case "excluded":
      return `Not shown: ${event.exclusion ? EXCLUSION_TEXT[event.exclusion] : "not eligible"}`;
    case "conditionsFailed":
      return isRecheck ? "Not shown: show conditions no longer met" : "Not shown: show conditions not met";
    case "conditionsUnreadable":
      return "Not shown: its show conditions could not be read";
    case "conditionsPassed":
      return isRecheck ? "Show conditions still met" : "Show conditions met";
    case "notSampled":
      return "Not shown: outside the display percentage";
    case "anotherSurveyOpen":
      return "Not shown: another survey is open";
    case "shown":
      return "Shown";
    default:
      return String(event.outcome);
  }
};

const OPERAND_TEXT: Record<string, string> = {
  currentUrl: "Current URL",
  queryParam: "Query parameter",
  pageReferrer: "Page referrer",
  entryReferrer: "Entry referrer",
  visitedUrls: "Visited URL",
  pagesViewed: "Pages viewed",
  uniquePagesViewed: "Unique pages viewed",
  timeOnSite: "Time on site (s)",
  deviceType: "Device",
  browser: "Browser",
  screenWidth: "Window width (px)",
};

const OPERATOR_TEXT: Record<string, string> = {
  equals: "is",
  doesNotEqual: "is not",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  containsAnyOf: "contains any of",
  containsNoneOf: "contains none of",
  pathIsAnyOf: "path is any of",
  pathIsNoneOf: "path is none of",
  isGreaterThan: ">",
  isLessThan: "<",
  isGreaterThanOrEqual: "≥",
  isLessThanOrEqual: "≤",
  includes: "includes",
  doesNotInclude: "does not include",
  isSet: "is set",
  isNotSet: "is not set",
};

const MAX_LIST_ENTRIES = 3;

const describeValue = (value: string | number | string[] | undefined): string => {
  if (value === undefined) return "";
  if (!Array.isArray(value)) return String(value);
  const shown = value.slice(0, MAX_LIST_ENTRIES).join(", ");
  return value.length > MAX_LIST_ENTRIES
    ? `${shown} (+${(value.length - MAX_LIST_ENTRIES).toString()})`
    : shown;
};

/** "Current URL contains any of /plans, /compare" — the condition in one line. */
export const describeCondition = (condition: TShowConditionSingle): string => {
  const operand = OPERAND_TEXT[condition.leftOperand.value] ?? condition.leftOperand.value;
  const key = condition.leftOperand.meta?.key ? ` "${condition.leftOperand.meta.key}"` : "";
  const operator = OPERATOR_TEXT[condition.operator] ?? condition.operator;
  return `${operand}${key} ${operator} ${describeValue(condition.rightOperand?.value)}`.trim();
};

/** What the evaluator read, e.g. `3` or `/plans · /compare`; "no value" when it had nothing. */
export const describeActual = (actual: unknown): string => {
  if (actual === null || actual === undefined) return "no value";
  if (Array.isArray(actual)) return actual.length === 0 ? "none" : actual.join(" · ");
  if (typeof actual === "string" || typeof actual === "number" || typeof actual === "boolean") {
    return String(actual);
  }
  return JSON.stringify(actual);
};

export const findCondition = (
  conditions: TShowConditions | undefined,
  id: string
): TShowConditionSingle | undefined => {
  if (!conditions) return undefined;
  for (const item of conditions.conditions) {
    if (isShowConditionGroup(item)) {
      const found = findCondition(item, id);
      if (found) return found;
    } else if (item.id === id) {
      return item;
    }
  }
  return undefined;
};

export interface TConditionRow {
  /** 0 for the outermost group, one more for each level inside it. */
  depth: number;
  passed: boolean;
  text: string;
}

/**
 * The checked conditions laid out as the editor shows them: each group's "all of" / "any of" with its
 * own ✓ or ✗, and its conditions indented under it (ENG-4070). Without the groups, a ✗ inside an
 * "any of" group that passed reads like the reason a survey did not show.
 *
 * `undefined` when the event carries no group outcomes: an SDK older than the panel sends only
 * `results`, and the panel then lists the conditions flat.
 */
export const describeConditionTree = (
  showConditions: TShowConditions | undefined,
  evaluation: { results: TShowConditionResult[]; groups?: TShowConditionGroupResult[] }
): TConditionRow[] | undefined => {
  if (!showConditions || !evaluation.groups) return undefined;

  const groupPassed = new Map(evaluation.groups.map((group) => [group.groupId, group.passed]));
  const results = new Map(evaluation.results.map((result) => [result.conditionId, result]));
  const rows: TConditionRow[] = [];

  const addGroup = (group: TShowConditionGroup, depth: number): void => {
    rows.push({
      depth,
      passed: groupPassed.get(group.id) ?? false,
      text: group.connector === "or" ? "Any of:" : "All of:",
    });
    for (const item of group.conditions) {
      if (isShowConditionGroup(item)) {
        addGroup(item, depth + 1);
        continue;
      }
      const result = results.get(item.id);
      rows.push({
        depth: depth + 1,
        passed: result?.passed ?? false,
        text: `${describeCondition(item)} — read: ${describeActual(result?.actual)}`,
      });
    }
  };

  addGroup(showConditions, 0);
  return rows;
};
