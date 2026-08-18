import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES } from "./errors";

const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
const gauges = new Map<string, { record: ReturnType<typeof vi.fn> }>();
const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn((name: string) => {
        const instrument = { add: vi.fn() };
        counters.set(name, instrument);
        return instrument;
      }),
      createGauge: vi.fn((name: string) => {
        const instrument = { record: vi.fn() };
        gauges.set(name, instrument);
        return instrument;
      }),
      createHistogram: vi.fn((name: string) => {
        const instrument = { record: vi.fn() };
        histograms.set(name, instrument);
        return instrument;
      }),
    })),
  },
}));

const {
  recordAuthzedOutboxStatus,
  recordAuthzedProjection,
  recordAuthzedReconciliationRepair,
  recordAuthzedRequestFailure,
  recordAuthzedRequestRetry,
  recordAuthzedRevocationDelivery,
} = await import("./metrics");

const counter = (name: string) => counters.get(name)!;
const histogram = (name: string) => histograms.get(name)!;

beforeEach(() => {
  for (const instrument of counters.values()) {
    instrument.add.mockClear();
  }
  for (const instrument of histograms.values()) {
    instrument.record.mockClear();
  }
  for (const instrument of gauges.values()) {
    instrument.record.mockClear();
  }
});

describe("recordAuthzedProjection", () => {
  test.each(["projected", "failed"] as const)("records a %s outcome and its duration", (status) => {
    recordAuthzedProjection({
      durationMs: 4200,
      operation: "reconcile_organization_memberships",
      projection: "organization_membership",
      status,
    });

    const attributes = {
      operation: "reconcile_organization_memberships",
      projection: "organization_membership",
      status,
    };
    expect(counter("formbricks_authzed_projection_total").add).toHaveBeenCalledWith(1, attributes);
    // Seconds, per the OpenTelemetry duration convention.
    expect(histogram("formbricks_authzed_projection_duration_seconds").record).toHaveBeenCalledWith(
      4.2,
      attributes
    );
  });

  test("counts a disabled projection but keeps its structural zero out of the latency histogram", () => {
    recordAuthzedProjection({
      durationMs: 0,
      operation: "reconcile_api_key_relationships",
      projection: "api_key",
      status: "disabled",
    });

    expect(counter("formbricks_authzed_projection_total").add).toHaveBeenCalledOnce();
    expect(histogram("formbricks_authzed_projection_duration_seconds").record).not.toHaveBeenCalled();
  });

  test("names the duration instrument so both exporters produce the series the runbook queries", () => {
    // The two exporters configured side by side derive the series name differently: the Prometheus
    // exporter appends only `_total` and emits the unit as a comment, while OTLP's translation appends
    // the unit unless the name already carries it. `_seconds` is the one spelling both agree on — and
    // the runbook's histogram_quantile query names exactly this series.
    expect(histograms.has("formbricks_authzed_projection_duration_seconds")).toBe(true);
    // The unit-less name would export as `..._duration` on a scrape, matching nothing the runbook asks
    // for; `_ms` was the original defect.
    expect(histograms.has("formbricks_authzed_projection_duration")).toBe(false);
    expect(histograms.has("formbricks_authzed_projection_duration_ms")).toBe(false);
  });
});

describe("recordAuthzedRequestFailure", () => {
  test("records the sanitized code, operation, and retryability", () => {
    recordAuthzedRequestFailure({
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      operation: "write_relationships",
      retryable: true,
    });

    expect(counter("formbricks_authzed_request_failures_total").add).toHaveBeenCalledWith(1, {
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      operation: "write_relationships",
      retryable: true,
    });
  });
});

describe("recordAuthzedRequestRetry", () => {
  test("records retries separately from failures", () => {
    // A retry that later succeeds never reaches the failure counter, so a degraded SpiceDB would
    // otherwise be invisible until it started dropping writes outright.
    recordAuthzedRequestRetry({
      code: AUTHZED_ERROR_CODES.TIMEOUT,
      operation: "read_relationships",
    });

    expect(counter("formbricks_authzed_request_retries_total").add).toHaveBeenCalledWith(1, {
      code: AUTHZED_ERROR_CODES.TIMEOUT,
      operation: "read_relationships",
    });
    expect(counter("formbricks_authzed_request_failures_total").add).not.toHaveBeenCalled();
  });
});

describe("recordAuthzedOutboxStatus", () => {
  test("records point-in-time queue state without identifier attributes", () => {
    recordAuthzedOutboxStatus({
      deadLettered: 2,
      oldestPendingAgeSeconds: 47,
      pending: 11,
      revocationsPastCritical: 1,
      revocationsPastWarning: 3,
    });

    const status = gauges.get("formbricks_authzed_projection_outbox_status")!;
    expect(status.record.mock.calls).toEqual([
      [11, { state: "pending" }],
      [2, { state: "dead_lettered" }],
      [3, { state: "revocation_warning" }],
      [1, { state: "revocation_critical" }],
    ]);
    expect(
      gauges.get("formbricks_authzed_projection_outbox_oldest_pending_age_seconds")!.record
    ).toHaveBeenCalledWith(47);
  });
});

describe("direct-authority recovery metrics", () => {
  test("records exact revocation propagation in seconds without attributes", () => {
    recordAuthzedRevocationDelivery(12_500);

    expect(
      histogram("formbricks_authzed_projection_revocation_delivery_duration_seconds").record
    ).toHaveBeenCalledWith(12.5);
  });

  test("records repaired and failed relationship counts separately", () => {
    recordAuthzedReconciliationRepair({ failed: 2, repaired: 7 });

    expect(counter("formbricks_authzed_reconciliation_repair_total").add.mock.calls).toEqual([
      [7, { status: "repaired" }],
      [2, { status: "failed" }],
    ]);
  });

  test("does not let exporter failures alter revocation delivery or repair", () => {
    histogram(
      "formbricks_authzed_projection_revocation_delivery_duration_seconds"
    ).record.mockImplementationOnce(() => {
      throw new Error("exporter unavailable");
    });
    counter("formbricks_authzed_reconciliation_repair_total").add.mockImplementationOnce(() => {
      throw new Error("exporter unavailable");
    });

    expect(() => recordAuthzedRevocationDelivery(1)).not.toThrow();
    expect(() => recordAuthzedReconciliationRepair({ failed: 0, repaired: 1 })).not.toThrow();
  });
});

describe("attribute cardinality", () => {
  test("never carries an identifier", () => {
    // These attributes leave the deployment when an OTLP endpoint is configured. An organization or
    // user ID here would be both a cardinality explosion and a privacy leak — the same rule the
    // logger follows.
    recordAuthzedProjection({
      durationMs: 1,
      operation: "reconcile_api_key_relationships",
      projection: "api_key",
      status: "failed",
    });
    recordAuthzedRequestFailure({
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "write_relationships",
      retryable: false,
    });
    recordAuthzedOutboxStatus({
      deadLettered: 0,
      oldestPendingAgeSeconds: null,
      pending: 1,
      revocationsPastCritical: 0,
      revocationsPastWarning: 0,
    });
    recordAuthzedReconciliationRepair({ failed: 1, repaired: 2 });
    recordAuthzedRevocationDelivery(1);

    const recordedAttributes = [
      ...counter("formbricks_authzed_projection_total").add.mock.calls,
      ...counter("formbricks_authzed_request_failures_total").add.mock.calls,
      ...counter("formbricks_authzed_reconciliation_repair_total").add.mock.calls,
      ...gauges.get("formbricks_authzed_projection_outbox_status")!.record.mock.calls,
    ].flatMap(([, attributes]) => Object.keys(attributes as object));

    expect([...new Set(recordedAttributes)].sort()).toEqual([
      "code",
      "operation",
      "projection",
      "retryable",
      "state",
      "status",
    ]);
  });
});
