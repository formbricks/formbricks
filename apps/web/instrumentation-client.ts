// This file configures the initialization of Sentry on the client.
// It runs before hydration, so it captures module-evaluation, hydration, and early-navigation
// errors that a useEffect-based init would miss.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
import * as Sentry from "@sentry/nextjs";
import type { SentryRuntimeConfig } from "@/lib/sentry-runtime-config";

declare global {
  interface Window {
    // Set by an inline `beforeInteractive` script in app/layout.tsx, populated from the request-time
    // SENTRY_DSN/SENTRY_ENVIRONMENT. DSN/environment can't be inlined at build time here: self-hosted
    // Docker images are built once and configure Sentry at container start, so a build-time value
    // would freeze in "unset" forever regardless of what operators set at runtime.
    __sentryRuntimeConfig?: SentryRuntimeConfig;
  }
}

const sentryDsn = window.__sentryRuntimeConfig?.dsn;
const isProduction = process.env.NODE_ENV === "production";

if (sentryDsn && isProduction) {
  Sentry.init({
    dsn: sentryDsn,
    release: process.env.SENTRY_RELEASE,
    environment: window.__sentryRuntimeConfig?.environment,

    // No tracing while Sentry doesn't update to telemetry 2.0.0.
    // https://github.com/getsentry/sentry-javascript/issues/15737
    tracesSampleRate: 0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Disable telemetry and additional data collection
    sendDefaultPii: false,
    sendClientReports: false,

    replaysOnErrorSampleRate: 1.0,

    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysSessionSampleRate: 0.1,

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    beforeSend(event, hint) {
      const error = hint.originalException as Error;

      // @ts-expect-error
      if (error?.digest === "NEXT_NOT_FOUND") {
        return null;
      }

      return event;
    },
  });
}
