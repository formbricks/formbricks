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
const LAST_READ_GAUGE = "formbricks_authzed_projection_outbox_status_last_read_timestamp_seconds";

const status = (oldestPendingAgeSeconds: number): TAuthzedOutboxStatus => ({
  deadLettered: 0,
  oldestPendingAgeSeconds,
  overdueRevocations: 0,
  pending: 1,
  revocationsPastCritical: 0,
  revocationsPastWarning: oldestPendingAgeSeconds >= 15 ? 1 : 0,
  unknownType: 0,
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

    const collect = async () => {
      exporter.reset();
      await reader.forceFlush();
      const exported = exporter
        .getMetrics()
        .flatMap((resourceMetric) => resourceMetric.scopeMetrics)
        .flatMap((scopeMetric) => scopeMetric.metrics);
      const valueOf = (name: string) =>
        exported.find((metric) => metric.descriptor.name === name)?.dataPoints[0]?.value;
      return { age: valueOf(AGE_GAUGE), lastRead: valueOf(LAST_READ_GAUGE) };
    };
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1_000_000);
    readStatus.mockResolvedValueOnce(status(3));
    expect(await collect()).toEqual({ age: 3, lastRead: 1_000 });

    // Delivery never ran; the revocation simply got older. The next collection has to see that.
    now.mockReturnValue(2_000_000);
    readStatus.mockResolvedValueOnce(status(50));
    expect(await collect()).toEqual({ age: 50, lastRead: 2_000 });

    // A failed read cannot clear what the SDK already holds: the age is re-exported as it was, and only
    // the read timestamp standing still tells an alert that it is stale.
    now.mockReturnValue(3_000_000);
    readStatus.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await collect()).toEqual({ age: 50, lastRead: 2_000 });
    expect(readStatus).toHaveBeenCalledTimes(3);
    now.mockRestore();
  });
});
