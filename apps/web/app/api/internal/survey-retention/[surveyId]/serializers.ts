import { serializeRetentionExemption } from "@/app/api/internal/retention-exemptions/serializers";
import type { TRetentionExemptionRow } from "@/modules/ee/data-retention/lib/exemptions-service";
import type { TSurveyRetentionPlan } from "@/modules/ee/data-retention/lib/survey-retention";
import type { TCappedCount } from "@/modules/ee/data-retention/lib/survey-retention-service";
import type { TSurveyRetention, TSurveyRetentionPolicy } from "@/modules/ee/data-retention/types";

/** What an organisation without the entitlement is told: nothing governs the survey. */
export const SURVEY_RETENTION_NOT_GOVERNED: TSurveyRetention = {
  governed: false,
  policies: [],
  exemptions: [],
};

/** One policy's plan for the survey, with the responses already due (none is shown as `null`). */
export const serializeSurveyRetentionPolicy = (
  plan: TSurveyRetentionPlan,
  dueCount: TCappedCount | null
): TSurveyRetentionPolicy => ({
  policy: plan.policy,
  exempt: plan.exempt,
  nextAction: plan.nextAction,
  nextDate: plan.nextDate?.toISOString() ?? null,
  dueCount: dueCount && dueCount.count > 0 ? dueCount : null,
});

/** The survey's retention (ENG-3695): governed while any policy is active for it. */
export const serializeSurveyRetention = (
  policies: TSurveyRetentionPolicy[],
  exemptions: readonly TRetentionExemptionRow[]
): TSurveyRetention => ({
  governed: policies.length > 0,
  policies,
  exemptions: exemptions.map(serializeRetentionExemption),
});
