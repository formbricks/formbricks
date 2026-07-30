import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES } from "./errors";

const counters = new Map<string, { add: ReturnType<typeof vi.fn> }>();
const histograms = new Map<string, { record: ReturnType<typeof vi.fn> }>();

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn((name: string) => {
        const instrument = { add: vi.fn() };
        counters.set(name, instrument);
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

const { recordAuthzedProjection, recordAuthzedRequestFailure, recordAuthzedRequestRetry } =
  await import("./metrics");

const counter = (name: string) => counters.get(name)!;
const histogram = (name: string) => histograms.get(name)!;

beforeEach(() => {
  for (const instrument of counters.values()) {
    instrument.add.mockClear();
  }
  for (const instrument of histograms.values()) {
    instrument.record.mockClear();
  }
});

describe("recordAuthzedProjection", () => {
  test.each(["projected", "failed", "disabled"] as const)(
    "records a %s outcome with its duration",
    (status) => {
      recordAuthzedProjection({
        durationMs: 42,
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
      expect(histogram("formbricks_authzed_projection_duration_ms").record).toHaveBeenCalledWith(
        42,
        attributes
      );
    }
  );
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

    const recordedAttributes = [
      ...counter("formbricks_authzed_projection_total").add.mock.calls,
      ...counter("formbricks_authzed_request_failures_total").add.mock.calls,
    ].flatMap(([, attributes]) => Object.keys(attributes as object));

    expect([...new Set(recordedAttributes)].sort()).toEqual([
      "code",
      "operation",
      "projection",
      "retryable",
      "status",
    ]);
  });
});
