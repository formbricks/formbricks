import { PROMETHEUS_ENABLED, SENTRY_DNS } from "@formbricks/lib/constants";

// instrumentation.ts
export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs" && PROMETHEUS_ENABLED) {
    await import("./instrumentation-node");
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && SENTRY_DNS) {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge" && SENTRY_DNS) {
    await import("./sentry.edge.config");
  }
};
