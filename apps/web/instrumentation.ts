import * as Sentry from "@sentry/nextjs";
import { type Instrumentation } from "next";
import { logger } from "@formbricks/logger";
import { isExpectedError } from "@formbricks/types/errors";
import { isPublicDomainRoute } from "@/app/middleware/endpoint-validator";
import { IS_PRODUCTION, PROMETHEUS_ENABLED, SENTRY_DSN } from "@/lib/constants";
import {
  assertAuthRuntimeConfiguration,
  assertAuthzedRuntimeConfiguration,
  warnOnAuthSecretRisks,
} from "@/lib/env";
import { tagRequestErrorWithUser } from "@/lib/sentry/request-error-user";

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  const [error, request] = args;

  // Skip expected business-logic errors (AuthorizationError, ResourceNotFoundError, etc.)
  // These are handled gracefully in the UI and don't need server-side Sentry reporting
  if (error instanceof Error && isExpectedError(error)) {
    return;
  }

  // Attribute the error to the signed-in user (id only). Runs only on this error path, only when Sentry
  // is on, and never for respondent-facing public routes (/s/, /c/, /p/, client APIs), which stay
  // anonymous. Node runtime only: the lookup needs Prisma and `node:crypto`; the import lives inside
  // this guard so the edge bundle never pulls it in, and edge errors keep being captured without a user.
  if (process.env.NEXT_RUNTIME === "nodejs" && Sentry.getClient() && !isPublicDomainRoute(request.path)) {
    await tagRequestErrorWithUser(error, request.headers, async (cookieHeader) => {
      const { getProxySessionFromCookieHeader } = await import("@/modules/auth/lib/proxy-session");
      const session = await getProxySessionFromCookieHeader(cookieHeader);
      return session?.userId ?? null;
    });
  }

  Sentry.captureRequestError(...args);
};

export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      assertAuthzedRuntimeConfiguration();
      assertAuthRuntimeConfiguration();
      warnOnAuthSecretRisks();
    }

    // Load OpenTelemetry instrumentation when Prometheus metrics or OTLP export is enabled
    if (PROMETHEUS_ENABLED || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      await import("./instrumentation-node");
    }

    // Skip runtime-only BullMQ bootstrapping during production builds.
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      try {
        const { registerJobsWorker, registerRecurringJobs } = await import("./instrumentation-jobs");
        void registerRecurringJobs().catch((error: unknown) => {
          logger.error(
            { err: error },
            "BullMQ recurring job registration failed during Next.js instrumentation"
          );
        });
        void registerJobsWorker().catch((error: unknown) => {
          logger.error({ err: error }, "BullMQ worker registration failed during Next.js instrumentation");
        });
      } catch (error) {
        logger.error({ err: error }, "BullMQ instrumentation import failed during Next.js instrumentation");
      }
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
