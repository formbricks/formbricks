import { beforeEach, describe, expect, test, vi } from "vitest";
import { recordWebhookDeliveryOutcome } from "./webhook-delivery-metrics";

const { mockAdd, mockRecord, mockCreateCounter, mockCreateHistogram } = vi.hoisted(() => {
  const mockAdd = vi.fn();
  const mockRecord = vi.fn();
  return {
    mockAdd,
    mockRecord,
    mockCreateCounter: vi.fn(() => ({ add: mockAdd })),
    mockCreateHistogram: vi.fn(() => ({ record: mockRecord })),
  };
});

vi.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: mockCreateCounter,
      createHistogram: mockCreateHistogram,
    })),
  },
}));

describe("recordWebhookDeliveryOutcome", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockRecord.mockClear();
  });

  test("creates the counter and histogram under stable names, once, on first use", async () => {
    // A fresh module instance, so the memoized instruments start empty regardless of test order.
    vi.resetModules();
    mockCreateCounter.mockClear();
    mockCreateHistogram.mockClear();
    const { recordWebhookDeliveryOutcome: record } = await import("./webhook-delivery-metrics");

    record({ outcome: "delivered", event: "responseFinished", statusCode: 200 });
    record({ outcome: "delivered", event: "responseFinished", statusCode: 200 });

    // The names are what dashboards and alerts key on, so they are pinned here.
    expect(mockCreateCounter).toHaveBeenCalledTimes(1);
    expect(mockCreateCounter).toHaveBeenCalledWith(
      "formbricks.webhook.delivery.total",
      expect.objectContaining({ unit: "{attempt}" })
    );
    expect(mockCreateHistogram).toHaveBeenCalledTimes(1);
    expect(mockCreateHistogram).toHaveBeenCalledWith(
      "formbricks.webhook.delivery.duration",
      expect.objectContaining({ unit: "ms" })
    );
  });

  test("counts and times a completed exchange with low-cardinality attributes only", () => {
    recordWebhookDeliveryOutcome({
      outcome: "delivered",
      event: "responseFinished",
      statusCode: 204,
      durationMs: 87,
    });

    const attributes = { outcome: "delivered", event: "responseFinished", status_class: "2xx" };
    expect(mockAdd).toHaveBeenCalledWith(1, attributes);
    expect(mockRecord).toHaveBeenCalledWith(87, attributes);
  });

  test("buckets the status code into its class", () => {
    recordWebhookDeliveryOutcome({ outcome: "permanent_failure", event: "responseCreated", statusCode: 404 });

    expect(mockAdd).toHaveBeenCalledWith(1, expect.objectContaining({ status_class: "4xx" }));
  });

  test("counts a skipped delivery without recording a duration or status class", () => {
    recordWebhookDeliveryOutcome({ outcome: "skipped_deleted", event: "responseUpdated" });

    expect(mockAdd).toHaveBeenCalledWith(1, { outcome: "skipped_deleted", event: "responseUpdated" });
    expect(mockRecord).not.toHaveBeenCalled();
  });

  test("records the duration of a failed exchange that never produced a status", () => {
    recordWebhookDeliveryOutcome({
      outcome: "retryable_failure",
      event: "responseFinished",
      durationMs: 5000,
    });

    expect(mockAdd).toHaveBeenCalledWith(1, { outcome: "retryable_failure", event: "responseFinished" });
    expect(mockRecord).toHaveBeenCalledWith(5000, {
      outcome: "retryable_failure",
      event: "responseFinished",
    });
  });
});
