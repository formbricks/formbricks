import type { TConditionGroup, TSingleCondition } from "./logic";

/**
 * Evaluates a condition group: recurse into nested groups, delegate leaf conditions to the caller,
 * then combine with the group's connector (`or` → any, otherwise → all).
 *
 * Shared because the two logic engines — `packages/surveys/src/lib/logic.ts` (the renderer) and
 * `apps/web/lib/surveyLogic/utils.ts` (quotas, summaries, follow-up conditions) — are near-copies of
 * each other, and this recursion was byte-identical in both. Same reasoning as `getLogicVariableValue`
 * in embedded-data-resolver.ts: the two engines disagreeing about how a survey evaluates is its own
 * bug class, so the rule gets one definition rather than two that can drift.
 *
 * Only the *grouping* is shared. How an individual condition resolves stays with each engine, which
 * is where they legitimately differ — the renderer sees a mid-survey response, the server a persisted
 * one.
 *
 * An empty group is true whatever its connector: the editor shows it as "Always", so an empty `or`
 * group runs like an empty `and` group instead of never (ADR 0026).
 */
export const evaluateConditionGroup = (
  group: TConditionGroup,
  evaluateCondition: (condition: TSingleCondition) => boolean
): boolean => {
  if (group.conditions.length === 0) return true;
  const results = group.conditions.map((condition) =>
    "conditions" in condition
      ? evaluateConditionGroup(condition, evaluateCondition)
      : evaluateCondition(condition)
  );

  return group.connector === "or" ? results.some((result) => result) : results.every((result) => result);
};

/**
 * Whether an element's stored answer is no answer at all: missing, or empty (`""`, `[]`, `{}`), the
 * values "is skipped" has always read as skipped.
 */
export const isUnansweredValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "object" && Object.keys(value).length === 0;
};

/** The operators that ask whether a question went unanswered: a CTA's "is not clicked" is its "is skipped". */
const UNANSWERED_OPERATORS: ReadonlySet<TSingleCondition["operator"]> = new Set([
  "isSkipped",
  "isNotClicked",
]);

/**
 * How a condition on a question nobody answered resolves (P71, jobenjada review #26), in both
 * engines and in show-if: false for every operator except "is skipped" (and a CTA's "is not
 * clicked"), and those are true only once the respondent passed the question without answering it.
 * A question on the page being filled in is not passed yet, so a follow-up never shows and then
 * disappears as the question above it is answered ("does not equal X" used to show it first).
 *
 * Returns `undefined` when the condition does not read an element, or the element has an answer: the
 * engine compares that answer as before.
 *
 * @param isPassed Whether the respondent has moved past the element. The renderer says no for the
 *   page being shown; a persisted response has passed everything it holds.
 */
export const evaluateUnansweredCondition = (
  condition: TSingleCondition,
  data: Record<string, unknown>,
  isPassed: (elementId: string) => boolean
): boolean | undefined => {
  const { leftOperand } = condition;
  if (leftOperand.type !== "element" || !isUnansweredValue(data[leftOperand.value])) return undefined;
  return UNANSWERED_OPERATORS.has(condition.operator) && isPassed(leftOperand.value);
};
