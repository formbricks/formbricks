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

const decisionsTotal = meter.createCounter("formbricks_authzed_authorization_decisions_total", {
  description: "Authoritative SpiceDB authorization decisions by bounded outcome",
});

const authorizationDuration = meter.createHistogram(
  "formbricks_authzed_authorization_decision_duration_seconds",
  {
    advice: {
      explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5],
    },
    description: "Duration of authoritative SpiceDB authorization operations",
    unit: "s",
  }
);

export type TAuthorizationDecisionOutcome = "allow" | "deny" | "operational_error";

type TAuthorizationDecisionMetricContext = Readonly<{
  action: TAuthorizationAction;
  actorType: TAuthorizationActor["type"];
  durationMs: number;
  resourceType: TAuthorizationResourceType;
  surface: TAuthzedAuthorizationRolloutSurface | "unscoped";
}>;

export type TAuthorizationDecisionMetric = TAuthorizationDecisionMetricContext &
  (
    | Readonly<{ errorCode?: never; outcome: Exclude<TAuthorizationDecisionOutcome, "operational_error"> }>
    | Readonly<{ errorCode: TAuthzedErrorCode; outcome: "operational_error" }>
  );

export const recordAuthorizationDecision = (metric: TAuthorizationDecisionMetric): void => {
  try {
    const attributes = {
      action: metric.action,
      actor_type: metric.actorType,
      error_code: metric.errorCode ?? "none",
      outcome: metric.outcome,
      resource_type: metric.resourceType,
      surface: metric.surface,
    };

    decisionsTotal.add(1, attributes);
    authorizationDuration.record(Math.max(0, metric.durationMs) / 1_000, {
      action: metric.action,
      actor_type: metric.actorType,
      outcome: metric.outcome,
      resource_type: metric.resourceType,
      surface: metric.surface,
    });
  } catch {
    // Telemetry must never alter an authoritative decision or turn an instrumentation outage into a
    // protected-operation outage.
  }
};

/** @deprecated Historical bridge telemetry. Remove with the rollout selector in ENG-2450. */
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

/**
 * ENG-1739: how many central authorization operations one request made.
 *
 * The perf harness times a single decision; it cannot see whether a page issues one decision or one
 * per row. A workspace-scoped list path that authorizes once still reports "fast" under that harness
 * even if a regression made it authorize per row, so this is the metric that catches an N+1.
 *
 * The lowest boundary is 0.5, not 1, and that is load-bearing. OpenTelemetry histogram buckets are
 * upper-inclusive and lower-exclusive, so boundaries starting at 1 put both 0 and 1 in `(-inf, 1]`.
 * Every wrapped request records — including the many that never authorize anything — so without the
 * 0.5 split the healthy single-check case is indistinguishable from "no authorization happened" on
 * the one histogram meant to make amplification visible.
 */
const checksPerRequest = meter.createHistogram("formbricks_authzed_authorization_checks_per_request", {
  advice: {
    explicitBucketBoundaries: [0.5, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 250, 350, 500, 750, 1000],
  },
  description: "Number of central authorization decisions made while handling one request",
  unit: "{check}",
});

/** Record one request's total central-operation count, tagged by the surface that served it. */
export const recordAuthorizationChecksPerRequest = (
  checksIssued: number,
  surface: TAuthzedAuthorizationRolloutSurface
): void => {
  checksPerRequest.record(checksIssued, { surface });
};

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

  try {
    comparisonsTotal.add(1, attributes);
    comparisonDuration.record(metric.durationMs / 1_000, {
      mode: metric.mode,
      outcome: metric.outcome,
      surface: metric.surface,
    });
  } catch {
    // Historical telemetry is fail-safe while the bridge code remains in the stacked branch.
  }
};
