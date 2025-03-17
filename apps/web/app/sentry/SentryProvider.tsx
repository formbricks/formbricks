"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface SentryProviderProps {
  children: React.ReactNode;
  sentryDns?: string;
}

export const SentryProvider = ({ children, sentryDns }: SentryProviderProps) => {
  useEffect(() => {
    if (sentryDns) {
      Sentry.init({
        dsn: sentryDns,

        // Adjust this value in production, or use tracesSampler for greater control
        tracesSampleRate: 1,

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
  }, []);

  return <>{children}</>;
};
