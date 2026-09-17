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
 */
export const evaluateConditionGroup = (
  group: TConditionGroup,
  evaluateCondition: (condition: TSingleCondition) => boolean
): boolean => {
  const results = group.conditions.map((condition) =>
    "conditions" in condition
      ? evaluateConditionGroup(condition, evaluateCondition)
      : evaluateCondition(condition)
  );

  return group.connector === "or" ? results.some((result) => result) : results.every((result) => result);
};
