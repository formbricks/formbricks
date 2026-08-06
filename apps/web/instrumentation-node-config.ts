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
