import "server-only";
import { metrics } from "@opentelemetry/api";

/**
 * Operational metrics for AuthZed relationship sync.
 *
 * Projection is best-effort by design: an outage never turns a successful PostgreSQL mutation into an
 * application error. That is the right trade-off, and it is also why drift can accumulate silently —
 * these counters are how an operator finds out, and what tells them to run `pnpm authzed:backfill`.
 *
 * Uses the OpenTelemetry metrics API, which the app already exports through both the Prometheus and
 * OTLP readers configured in `instrumentation-node.ts`. When neither is enabled `getMeter` returns a
 * no-op meter, so recording is safe with zero configuration and costs nothing.
 *
 * **Every attribute is a bounded, enumerable value — never an identifier.** Same rule as the logger:
 * these leave the deployment when an OTLP endpoint is configured, and an organization or user ID here
 * would be both a cardinality explosion and a privacy leak.
 *
 * Note this covers the always-on request path only. The backfill command is a short-lived process with
 * no scrape window and no flush, so its observability is the counters in its own JSON result and its
 * exit code.
 */

const meter = metrics.getMeter("formbricks.authzed");

/** Projection outcomes, by operation and projector. Includes `disabled` so a misconfigured deployment is visible. */
const projectionTotal = meter.createCounter("formbricks_authzed_projection_total", {
  description: "AuthZed relationship projections by outcome",
});

const projectionDuration = meter.createHistogram("formbricks_authzed_projection_duration_ms", {
  description: "Duration of AuthZed relationship projections",
  unit: "ms",
});

/**
 * Requests that exhausted their retry budget.
 *
 * The signal that distinguishes a blip from an outage: a sustained rate here means relationships are
 * being dropped and a backfill will be needed once the cause is resolved.
 */
const requestFailuresTotal = meter.createCounter("formbricks_authzed_request_failures_total", {
  description: "AuthZed requests that failed after exhausting retries",
});

/** Retries scheduled. Elevated but non-failing means SpiceDB is degraded rather than down. */
const requestRetriesTotal = meter.createCounter("formbricks_authzed_request_retries_total", {
  description: "AuthZed requests retried after a retryable failure",
});

export type TAuthzedProjectionMetric = Readonly<{
  durationMs: number;
  operation: string;
  projection: string;
  status: "disabled" | "failed" | "projected";
}>;

export const recordAuthzedProjection = ({
  durationMs,
  operation,
  projection,
  status,
}: TAuthzedProjectionMetric): void => {
  const attributes = { operation, projection, status };
  projectionTotal.add(1, attributes);
  projectionDuration.record(durationMs, attributes);
};

export type TAuthzedRequestFailureMetric = Readonly<{
  code: string;
  operation: string;
  retryable: boolean;
}>;

export const recordAuthzedRequestFailure = ({
  code,
  operation,
  retryable,
}: TAuthzedRequestFailureMetric): void => {
  requestFailuresTotal.add(1, { code, operation, retryable });
};

export const recordAuthzedRequestRetry = ({
  code,
  operation,
}: Readonly<{ code: string; operation: string }>): void => {
  requestRetriesTotal.add(1, { code, operation });
};
