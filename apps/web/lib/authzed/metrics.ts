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
 *
 * **A deliberate deviation from the semantic conventions, which prescribe dots as namespace delimiters
 * (`formbricks.authzed.projection.duration`) and say a unit need not appear in the name.** This app
 * configures the Prometheus reader *and* an OTLP reader at once, and the two derive a series name
 * differently: the Prometheus exporter sanitizes dots to underscores and appends no unit, while OTLP's
 * Prometheus translation appends the unit unless the name already carries it. Under the conventional
 * spelling the same instrument would surface as `..._duration` on a scrape and `..._duration_seconds`
 * through a collector — so the runbook could not name one series, which is exactly the defect this
 * naming replaced. Prometheus-style names with the unit spelled out are the only form both paths agree
 * on. Revisit if the Prometheus reader is ever dropped.
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
  // The SDK's default boundaries are `[0, 5, 10, 25, … 10000]` — a millisecond scale. Recording seconds
  // against them puts every healthy projection in the single `(0, 5]` bucket, and `histogram_quantile`
  // interpolates within a bucket: a p95 over observations that are all ~100ms reports something close to
  // 4.75s, so the runbook's `> 0.5` alert would fire continuously on healthy traffic. These are the
  // semantic conventions' second-scale boundaries, which include 0.5 exactly so the alert threshold
  // falls on a boundary rather than inside a bucket.
  advice: {
    explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10],
  },
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

const outboxDeliveryTotal = meter.createCounter("formbricks_authzed_projection_outbox_delivery_total", {
  description: "Authorization projection outbox events processed by outcome",
});

const outboxDeliveryDuration = meter.createHistogram(
  "formbricks_authzed_projection_outbox_delivery_duration_seconds",
  {
    advice: {
      explicitBucketBoundaries: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    },
    description: "Duration of an authorization projection outbox delivery batch",
    unit: "s",
  }
);

const reconciliationAuditTotal = meter.createCounter("formbricks_authzed_reconciliation_audit_total", {
  description: "Scheduled authorization relationship audits by outcome",
});

const reconciliationDriftTotal = meter.createCounter("formbricks_authzed_reconciliation_drift_total", {
  description: "Attributable relationship differences observed by scheduled audits",
});

const outboxStatus = meter.createGauge("formbricks_authzed_projection_outbox_status", {
  description: "Point-in-time authorization projection outbox counts by bounded state",
  unit: "{event}",
});

const outboxOldestPendingAge = meter.createGauge(
  "formbricks_authzed_projection_outbox_oldest_pending_age_seconds",
  {
    description: "Point-in-time age of the oldest pending authorization projection event",
    unit: "s",
  }
);

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

export const recordAuthzedOutboxDelivery = ({
  count,
  durationMs,
  status,
}: Readonly<{
  count: number;
  durationMs: number;
  status: "delivered" | "failed";
}>): void => {
  outboxDeliveryTotal.add(count, { status });
  outboxDeliveryDuration.record(durationMs / 1000, { status });
};

export const recordAuthzedOutboxStatus = ({
  deadLettered,
  oldestPendingAgeSeconds,
  pending,
  revocationsPastCritical,
  revocationsPastWarning,
}: Readonly<{
  deadLettered: number;
  oldestPendingAgeSeconds: number | null;
  pending: number;
  revocationsPastCritical: number;
  revocationsPastWarning: number;
}>): void => {
  outboxStatus.record(pending, { state: "pending" });
  outboxStatus.record(deadLettered, { state: "dead_lettered" });
  outboxStatus.record(revocationsPastWarning, { state: "revocation_warning" });
  outboxStatus.record(revocationsPastCritical, { state: "revocation_critical" });
  outboxOldestPendingAge.record(oldestPendingAgeSeconds ?? 0);
};

export const recordAuthzedReconciliationAudit = ({
  drift,
  failures,
  status,
}: Readonly<{
  drift: number;
  failures: number;
  status: "drifted" | "failed" | "reconciled";
}>): void => {
  reconciliationAuditTotal.add(1, { status });
  if (drift > 0) reconciliationDriftTotal.add(drift, { kind: "attributable" });
  if (failures > 0) reconciliationDriftTotal.add(failures, { kind: "failure" });
};
