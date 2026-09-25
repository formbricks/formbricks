import { metrics } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TV3ResponsesReadSample } from "./metrics";

/**
 * Bucket configuration and exported names, verified against the real SDK rather than by asserting the
 * advice object — the advice is a hint, and what matters is what lands on the exported data point.
 *
 * `metrics.test.ts` mocks `@opentelemetry/api`; this file deliberately does not, so it sees the
 * instruments the way an exporter does.
 */

type THistogramValue = Readonly<{
  buckets: Readonly<{ boundaries: number[]; counts: number[] }>;
  sum?: number;
}>;

const exportOnce = async (samples: TV3ResponsesReadSample[]) => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  // A long interval so nothing exports on a timer; `forceFlush` is what drives the export here.
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);

  // A fresh module per provider: the instruments are memoized on first use and bind to whichever
  // provider is global at that moment, so a cached module would keep recording into the last test's.
  vi.resetModules();
  const { recordV3ResponsesRead } = await import("./metrics");
  for (const sample of samples) recordV3ResponsesRead(sample);

  await reader.forceFlush();
  const exported = exporter
    .getMetrics()
    .flatMap((resourceMetric) => resourceMetric.scopeMetrics)
    .flatMap((scopeMetric) => scopeMetric.metrics);
  const byName = (name: string) => exported.find((metric) => metric.descriptor.name === name);

  return { provider, byName };
};

describe("v3 responses read metrics, as exported", () => {
  let shutdown: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await shutdown?.();
    shutdown = undefined;
    metrics.disable();
  });

  test("an empty page and a one-survey page land in different buckets", async () => {
    const { provider, byName } = await exportOnce([
      { operation: "list", via: "api", status: 200, durationMs: 1, pageSurveyCount: 0 },
      { operation: "list", via: "api", status: 200, durationMs: 1, pageSurveyCount: 1 },
    ]);
    shutdown = () => provider.shutdown();

    const value = byName("formbricks_api_v3_responses_page_surveys")?.dataPoints[0]?.value as
      | THistogramValue
      | undefined;

    expect(value?.buckets.boundaries[0]).toBe(0.5);
    // Buckets are upper-inclusive: (-inf, 0.5] holds the empty page, (0.5, 1] the one-survey page.
    expect(value?.buckets.counts.slice(0, 2)).toEqual([1, 1]);
  });

  test("duration is exported in seconds on second-scale buckets", async () => {
    const { provider, byName } = await exportOnce([
      { operation: "get", via: "api", status: 200, durationMs: 100 },
    ]);
    shutdown = () => provider.shutdown();

    const value = byName("formbricks_api_v3_responses_read_duration_seconds")?.dataPoints[0]?.value as
      | THistogramValue
      | undefined;

    // 100ms in, 0.1 recorded — a unit mismatch would be invisible to the bucket assertion alone.
    expect(value?.sum).toBeCloseTo(0.1);
    expect(Math.max(...(value?.buckets.boundaries ?? []))).toBeLessThanOrEqual(10);
  });

  test("the counter is exported under its Prometheus name, byte for byte", async () => {
    const { provider, byName } = await exportOnce([
      { operation: "count", via: "mcp", status: 200, durationMs: 1 },
    ]);
    shutdown = () => provider.shutdown();

    const counter = byName("formbricks_api_v3_responses_reads_total");
    expect(counter?.descriptor.name).toBe("formbricks_api_v3_responses_reads_total");
    expect(counter?.dataPoints[0]?.value).toBe(1);
  });
});
