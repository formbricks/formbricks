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

/**
 * Seconds, with the unit spelled out in the instrument name.
 *
 * The semantic conventions prescribe seconds for durations, which rules out the `_ms` this started as.
 * The unit belongs in the *name* as well because the two exporters this app configures side by side
 * derive the series name differently: `@opentelemetry/exporter-prometheus` appends only `_total`, to
 * monotonic sums, and emits the unit as a `# UNIT` comment rather than a suffix, while OTLP's Prometheus
 * translation appends the unit — skipping it when the name already carries it. Naming it `_seconds` is
 * therefore the one spelling both paths agree on, and the runbook's alert queries can name a single
 * series. Leaving the unit out of the name would export `..._duration` on a scrape and
 * `..._duration_seconds` through a collector, which is how the runbook's histogram query came to match
 * nothing on the scrape path.
 */
const projectionDuration = meter.createHistogram("formbricks_authzed_projection_duration_seconds", {
  description: "Duration of AuthZed relationship projections",
  unit: "s",
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

  // `disabled` short-circuits before any work, so its duration is a structural zero rather than a
  // measurement. Recording it would drag the latency distribution of every quantile toward zero on a
  // deployment that has AuthZed switched off — and latency is the signal the runbook calls user-visible.
  if (status !== "disabled") {
    projectionDuration.record(durationMs / 1000, attributes);
  }
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
