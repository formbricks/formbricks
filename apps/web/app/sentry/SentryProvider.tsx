"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface SentryProviderProps {
  children: React.ReactNode;
  sentryDsn?: string;
  sentryRelease?: string;
  isEnabled?: boolean;
}

export const SentryProvider = ({ children, sentryDsn, sentryRelease, isEnabled }: SentryProviderProps) => {
  useEffect(() => {
    if (sentryDsn && isEnabled) {
      Sentry.init({
        dsn: sentryDsn,
        release: sentryRelease,

        // No tracing while Sentry doesn't update to telemetry 2.0.0 - https://github.com/getsentry/sentry-javascript/issues/15737
        tracesSampleRate: 0,

        // Setting this option to true will print useful information to the console while you're setting up Sentry.
        debug: false,

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
          if (error && error.digest === "NEXT_NOT_FOUND") {
            return null;
          }

          return event;
        },
      });
    }
    // We only want to run this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
};
