import { metrics } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TAuthzedOutboxStatus } from "./outbox-types";

/**
 * Outbox health, collected through the real SDK (ENG-3764).
 *
 * The unit tests in `metrics.test.ts` prove what the callback observes; this proves the SDK actually
 * awaits it on every collection, which is the whole point: the gauges used to be set only when a delivery
 * run finished, so a stalled delivery exported a frozen, healthy-looking value while the freshness guard
 * denied every authorization check.
 */

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));

const AGE_GAUGE = "formbricks_authzed_projection_outbox_oldest_pending_age_seconds";

const status = (oldestPendingAgeSeconds: number): TAuthzedOutboxStatus => ({
  deadLettered: 0,
  oldestPendingAgeSeconds,
  overdueRevocations: 0,
  pending: 1,
  revocationsPastCritical: 0,
  revocationsPastWarning: oldestPendingAgeSeconds >= 15 ? 1 : 0,
});

describe("outbox status gauges", () => {
  let provider: MeterProvider | undefined;

  afterEach(async () => {
    await provider?.shutdown();
    provider = undefined;
    metrics.disable();
  });

  test("export the outbox as it is at each collection, with no delivery run in between", async () => {
    const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    // A long interval so nothing exports on a timer; `forceFlush` drives each collection.
    const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
    provider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(provider);

    const readStatus = vi.fn<() => Promise<TAuthzedOutboxStatus>>();
    const { observeAuthzedOutboxStatus } = await import("./metrics");
    observeAuthzedOutboxStatus(readStatus);

    const collectAge = async () => {
      exporter.reset();
      await reader.forceFlush();
      return exporter
        .getMetrics()
        .flatMap((resourceMetric) => resourceMetric.scopeMetrics)
        .flatMap((scopeMetric) => scopeMetric.metrics)
        .find((metric) => metric.descriptor.name === AGE_GAUGE)?.dataPoints[0]?.value;
    };

    readStatus.mockResolvedValueOnce(status(3));
    expect(await collectAge()).toBe(3);

    // Delivery never ran; the revocation simply got older. The next collection has to see that.
    readStatus.mockResolvedValueOnce(status(50));
    expect(await collectAge()).toBe(50);
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
});
