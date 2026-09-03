import { metrics } from "@opentelemetry/api";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * ENG-1739 — the checks-per-request histogram, verified against a real SDK rather than by asserting
 * the advice object.
 *
 * `advice` is only a *hint*: whether it takes effect depends on the SDK honouring it, so asserting
 * the boundaries we passed in would restate the source and prove nothing. What is worth pinning is
 * what lands on the exported data point, and that the whole path — `withAuthorizationSurface` →
 * `after()` → `record` — actually produces one.
 *
 * The load-bearing assertion is the bucket *separation* between 0 and 1. OpenTelemetry buckets are
 * upper-inclusive and lower-exclusive, so a boundary list starting at 1 puts a request that made no
 * authorization decisions and a request that made exactly one into the same `(-inf, 1]` bucket.
 * Every wrapped request records, and most product requests authorize once, so under those boundaries
 * the healthy case would be unreadable on the very histogram that exists to make amplification
 * visible. Asserting the two land in different buckets fails if that boundary is ever removed.
 */

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void> | void) => afterCallbacks.push(callback)),
}));

const HISTOGRAM_NAME = "formbricks_authzed_authorization_checks_per_request";

type TBuckets = Readonly<{ boundaries: number[]; counts: number[] }>;
type THistogramValue = Readonly<{ buckets: TBuckets; count: number; sum: number }>;

const recordRequestWithChecks = async (
  checkCount: number,
  surface: "api_v3" | "server_action" = "server_action"
) => {
  afterCallbacks.length = 0;
  // Each case needs the histogram bound to *its* provider, and the instrument is created at module
  // load, so the module graph has to be rebuilt after the provider is installed.
  vi.resetModules();
  // `setGlobalMeterProvider` is a no-op while a global is already registered, so a second call
  // without this would silently leave the instrument bound to the previous (already shut down)
  // provider and export nothing.
  metrics.disable();

  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  // A long interval so nothing exports on a timer; `forceFlush` is what drives the export here.
  const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);

  const { recordAuthorizationCheckIssued, withAuthorizationSurface } = await import("./context");

  await withAuthorizationSurface(surface, async () => {
    for (let index = 0; index < checkCount; index += 1) recordAuthorizationCheckIssued();
  });
  await afterCallbacks[0]();

  await reader.forceFlush();
  const dataPoint = exporter
    .getMetrics()
    .flatMap((resourceMetric) => resourceMetric.scopeMetrics)
    .flatMap((scopeMetric) => scopeMetric.metrics)
    .find((metric) => metric.descriptor.name === HISTOGRAM_NAME)?.dataPoints[0];

  return { dataPoint, provider, value: dataPoint?.value as THistogramValue | undefined };
};

/** The single populated bucket for a one-observation histogram. */
const occupiedBucketIndex = (value: THistogramValue | undefined): number =>
  (value?.buckets.counts ?? []).findIndex((count) => count > 0);

describe("checks-per-request histogram", () => {
  let shutdown: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await shutdown?.();
    shutdown = undefined;
    metrics.disable();
  });

  test("a request making no checks and one making a single check land in different buckets", async () => {
    const none = await recordRequestWithChecks(0);
    shutdown = () => none.provider.shutdown();
    const noneIndex = occupiedBucketIndex(none.value);
    await shutdown();

    const one = await recordRequestWithChecks(1);
    shutdown = () => one.provider.shutdown();
    const oneIndex = occupiedBucketIndex(one.value);

    expect(noneIndex).toBeGreaterThanOrEqual(0);
    expect(oneIndex).toBeGreaterThanOrEqual(0);
    // Without the 0.5 boundary both are bucket 0 and this equality holds — which is the regression.
    expect(oneIndex).not.toBe(noneIndex);
  });

  test("exports the request's check count as the observed value, tagged by surface", async () => {
    const { dataPoint, provider, value } = await recordRequestWithChecks(7, "api_v3");
    shutdown = () => provider.shutdown();

    expect(value?.count).toBe(1);
    // The observation is the count itself, not a duration or a rate.
    expect(value?.sum).toBe(7);
    expect(dataPoint?.attributes).toEqual({ surface: "api_v3" });
  });

  test("keeps resolution across the amplification range a regression would move through", async () => {
    const { provider, value } = await recordRequestWithChecks(1);
    shutdown = () => provider.shutdown();

    const boundaries = value?.buckets.boundaries ?? [];
    expect(boundaries[0]).toBe(0.5);
    // A per-row regression on a 3,000-row list has to remain distinguishable from a healthy request
    // rather than saturating the final bucket.
    expect(Math.max(...boundaries)).toBeGreaterThanOrEqual(1_000);
    // Enough small buckets that going from 1 check to a handful is visible, not averaged away.
    expect(boundaries.filter((boundary) => boundary <= 10)).toHaveLength(6);
  });
});
