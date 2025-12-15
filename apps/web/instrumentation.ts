import * as Sentry from "@sentry/nextjs";
import { IS_PRODUCTION, PROMETHEUS_ENABLED, SENTRY_DSN } from "@/lib/constants";
import { setupGlobalAgentProxy } from "@/lib/setupGlobalAgentProxy";

export const onRequestError = Sentry.captureRequestError;

export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize global-agent proxy support (opt-in via USE_GLOBAL_AGENT_PROXY=1)
    // Must run before any outbound HTTP requests to ensure proxy settings are applied
    setupGlobalAgentProxy();

    if (PROMETHEUS_ENABLED) {
      await import("./instrumentation-node");
    }
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && IS_PRODUCTION && SENTRY_DSN) {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge" && IS_PRODUCTION && SENTRY_DSN) {
    await import("./sentry.edge.config");
  }
};
