import { type InstrumentationConfigMap } from "@opentelemetry/auto-instrumentations-node";

export const nodeAutoInstrumentationConfig: InstrumentationConfigMap = {
  "@opentelemetry/instrumentation-fs": {
    enabled: false,
  },
  "@opentelemetry/instrumentation-dns": {
    enabled: false,
  },
  "@opentelemetry/instrumentation-net": {
    enabled: false,
  },
  // PrismaInstrumentation handles database tracing.
  "@opentelemetry/instrumentation-pg": {
    enabled: false,
  },
  "@opentelemetry/instrumentation-http": {
    ignoreIncomingRequestHook: (req) => {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      return (
        pathname === "/health" ||
        pathname === "/api/v2/health" ||
        pathname === "/metrics" ||
        pathname.startsWith("/metrics/")
      );
    },
  },
  "@opentelemetry/instrumentation-pino": {
    // The dedicated Pino transport is gated by OTEL_LOGS_ENABLED and owns log export.
    disableLogSending: true,
  },
  "@opentelemetry/instrumentation-runtime-node": {
    enabled: true,
  },
};

const DEFAULT_METRIC_EXPORT_INTERVAL_MS = 60_000;
/** Node's timer limit; a longer interval silently fires after 1 ms and turns every export into a busy loop. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * The OTLP metric export interval, from the standard `OTEL_METRIC_EXPORT_INTERVAL` (milliseconds).
 *
 * The default stays 60 s, but the AuthZed outbox alerts have to land before the 60 s freshness guard
 * trips, which a 60 s export cannot promise for a 15 s warning (ENG-3764) — so an operator alerting on
 * them sets this lower. Anything that is not a positive integer within Node's timer limit falls back to the
 * default rather than failing boot: telemetry must never take the app down.
 */
export const getMetricExportIntervalMs = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_TIMER_DELAY_MS
    ? parsed
    : DEFAULT_METRIC_EXPORT_INTERVAL_MS;
};
