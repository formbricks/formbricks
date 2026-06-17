import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TV3SurveyDistribution, TV3SurveyTargeting } from "./schemas";

const responseLimitOrNull = (value: number | null): number | null =>
  typeof value === "number" && value >= 1 ? value : null;
const nonNegativeOrNull = (value: number | null): number | null =>
  typeof value === "number" && value >= 0 ? value : null;
const percentageOrNull = (value: number | null): number | null =>
  typeof value === "number" && value >= 0.01 && value <= 100 ? value : null;

/** Internal survey triggers → the public `{ actionClassId }[]` shape. */
function surveyTriggersToV3(triggers: TSurvey["triggers"]): TV3SurveyDistribution["triggers"] {
  return triggers.map((trigger) => ({ actionClassId: trigger.actionClass.id }));
}

/**
 * Build the public `distribution` block from a stored survey — the single mapper used by both the GET
 * serializer and the PATCH document reconstruction (so the two can't drift). Defensively clamps any
 * stored value that predates or violates the current public constraints to a schema-valid one, so
 * reconstructing an existing survey for PATCH never fails and GET never emits out-of-contract values.
 * For normally-authored surveys these clamps are no-ops.
 */
export function surveyToV3Distribution(survey: TSurvey): TV3SurveyDistribution {
  return {
    displayOption: survey.displayOption,
    displayPercentage: percentageOrNull(survey.displayPercentage),
    displayLimit: nonNegativeOrNull(survey.displayLimit),
    recontactDays: nonNegativeOrNull(survey.recontactDays),
    autoClose: nonNegativeOrNull(survey.autoClose),
    autoComplete: responseLimitOrNull(survey.autoComplete),
    delay: nonNegativeOrNull(survey.delay) ?? 0,
    triggers: surveyTriggersToV3(survey.triggers),
  };
}

/** Build the public `targeting` block from a stored survey's segment (empty filters = "show everyone"). */
export function surveyToV3Targeting(survey: TSurvey): TV3SurveyTargeting {
  return { filters: (survey.segment?.filters ?? []) as TV3SurveyTargeting["filters"] };
}

/**
 * Public `distribution` scalars → the internal survey scalar columns (used by the create and patch
 * write paths). Triggers are intentionally excluded — create resolves them to full action-class
 * objects and patch turns them into a relation diff, so each caller handles triggers itself.
 */
export function v3DistributionToScalars(
  distribution: TV3SurveyDistribution
): Omit<TV3SurveyDistribution, "triggers"> {
  const { triggers: _triggers, ...scalars } = distribution;
  return scalars;
}
