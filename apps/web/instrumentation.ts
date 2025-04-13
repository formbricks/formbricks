import * as Sentry from "@sentry/nextjs";
import { PROMETHEUS_ENABLED, SENTRY_DSN } from "@formbricks/lib/constants";

export const onRequestError = Sentry.captureRequestError;

// instrumentation.ts
export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs" && PROMETHEUS_ENABLED) {
    await import("./instrumentation-node");
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && SENTRY_DSN) {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge" && SENTRY_DSN) {
    await import("./sentry.edge.config");
  }
};
