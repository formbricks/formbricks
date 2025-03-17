"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Shutdown any existing Sentry instance
    if (typeof window !== "undefined" && (window as any).__SENTRY__ && (window as any).__SENTRY__.hub) {
      console.log("Shutting down existing Sentry client");
      Sentry.close();
    }

    // Check for DSN at runtime
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

    if (dsn) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

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

    // Clean up when component unmounts
    return () => {
      // Optional: close Sentry if needed
      // Sentry.close();
    };
  }, []);

  return <>{children}</>;
}
