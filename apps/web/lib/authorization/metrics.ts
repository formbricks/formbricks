import "server-only";
import { metrics } from "@opentelemetry/api";
import type { TAuthzedErrorCode } from "@/lib/authzed/errors";
import type { TAuthorizationSurface } from "./context";
import type { TAuthorizationAction, TAuthorizationActor, TAuthorizationResourceType } from "./contract";

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
  surface: TAuthorizationSurface | "unscoped";
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
  surface: TAuthorizationSurface
): void => {
  checksPerRequest.record(checksIssued, { surface });
};
