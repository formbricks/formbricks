import "server-only";
import { metrics } from "@opentelemetry/api";
import type { TAuthzedErrorCode } from "@/lib/authzed/errors";
import type { TAuthzedAuthorizationRolloutSurface } from "@/lib/authzed/rollout-contract";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceType } from "./contract";

export type TAuthorizationComparisonOutcome =
  | "match"
  | "legacy_allow_authzed_deny"
  | "legacy_deny_authzed_allow"
  | "operational_error";

export type TAuthorizationDecisionLabel = "allow" | "deny" | "unknown";
export type TAuthorizationErrorSource = "authzed" | "legacy" | "scheduler" | "source";

const meter = metrics.getMeter("formbricks.authzed.authorization");

const comparisonsTotal = meter.createCounter("formbricks_authzed_authorization_comparisons_total", {
  description: "Legacy and AuthZed authorization comparison outcomes",
});

const comparisonDuration = meter.createHistogram("formbricks_authzed_authorization_duration_seconds", {
  advice: {
    explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5],
  },
  description: "Duration of the non-authoritative authorization comparison",
  unit: "s",
});

export type TAuthorizationComparisonMetric = Readonly<{
  action: TAuthorizationAction;
  actorType: TAuthorizationActor["type"];
  authzedDecision: TAuthorizationDecisionLabel;
  cohort: string;
  durationMs: number;
  errorCode?: TAuthzedErrorCode;
  errorSource?: TAuthorizationErrorSource;
  legacyDecision: TAuthorizationDecisionLabel;
  mode: "enforcement" | "shadow";
  outcome: TAuthorizationComparisonOutcome;
  resourceType: TAuthorizationResourceType;
  surface: TAuthzedAuthorizationRolloutSurface;
}>;

export const recordAuthorizationComparison = (metric: TAuthorizationComparisonMetric): void => {
  const attributes = {
    action: metric.action,
    actor_type: metric.actorType,
    authzed_decision: metric.authzedDecision,
    cohort: metric.cohort,
    error_code: metric.errorCode ?? "none",
    error_source: metric.errorSource ?? "none",
    legacy_decision: metric.legacyDecision,
    mode: metric.mode,
    outcome: metric.outcome,
    resource_type: metric.resourceType,
    surface: metric.surface,
  };

  comparisonsTotal.add(1, attributes);
  comparisonDuration.record(metric.durationMs / 1_000, attributes);
};
