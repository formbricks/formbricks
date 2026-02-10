import * as Sentry from "@sentry/nextjs";
import { IS_PRODUCTION, PROMETHEUS_ENABLED, SENTRY_DSN } from "@/lib/constants";

export const onRequestError = Sentry.captureRequestError;

export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Load OpenTelemetry instrumentation when Prometheus metrics or OTLP export is enabled
    if (PROMETHEUS_ENABLED || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      await import("./instrumentation-node");
    }
  }
  // Sentry init loads after OTEL to avoid TracerProvider conflicts
  // Sentry tracing is disabled (tracesSampleRate: 0) -- SigNoz handles distributed tracing
  if (process.env.NEXT_RUNTIME === "nodejs" && IS_PRODUCTION && SENTRY_DSN) {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge" && IS_PRODUCTION && SENTRY_DSN) {
    await import("./sentry.edge.config");
  }
};
