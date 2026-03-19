import * as Sentry from "@sentry/nextjs";
import { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";
import { isExpectedError } from "@formbricks/types/errors";
import { IS_PRODUCTION, PROMETHEUS_ENABLED, SENTRY_DSN } from "@/lib/constants";

export const onRequestError: InstrumentationOnRequestError = (...args) => {
  const [error] = args;

  // Skip expected business-logic errors (AuthorizationError, ResourceNotFoundError, etc.)
  // These are handled gracefully in the UI and don't need server-side Sentry reporting
  if (error instanceof Error && isExpectedError(error)) {
    return;
  }

  Sentry.captureRequestError(...args);
};

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
