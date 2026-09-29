import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_CLIENT_RUNTIME_CONFIG_KEY,
  type TSentryClientRuntimeConfig,
} from "@/lib/sentry/client-runtime-config";
import { isStaleServerActionError } from "@/lib/utils/stale-server-action";

let hasInitialized = false;

const initSentry = (config: TSentryClientRuntimeConfig) => {
  if (hasInitialized || !config.dsn) {
    return;
  }

  hasInitialized = true;

  Sentry.init({
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,

    // No tracing while Sentry doesn't update to telemetry 2.0.0 - https://github.com/getsentry/sentry-javascript/issues/15737
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

      // @ts-expect-error -- `digest` is attached by Next.js, not part of the Error type
      if (error?.digest === "NEXT_NOT_FOUND") {
        return null;
      }

      // A tab that outlived its deployment invokes server action ids the new server no longer
      // knows. Every deploy re-inflicts this on every open tab, so it is the highest-volume error
      // in the project; `StaleDeploymentPrompt` now turns it into a reload prompt, which makes it
      // handled and expected rather than something to spend the error budget on.
      if (isStaleServerActionError(error)) {
        return null;
      }

      return event;
    },
  });
};

/**
 * Initialises the browser Sentry client from the config the root layout serialises into the HTML.
 *
 * The instrumentation bundle and the layout's inline config script race: the bundle is loaded with
 * `async`, so a warm cache can execute it before the document body is parsed. Both orders are
 * handled -- if the config is already there we init straight away, otherwise a one-shot accessor
 * inits the moment the inline script assigns it. Either way this runs before hydration and before
 * app code, so module-evaluation and hydration errors are captured.
 *
 * When Sentry is disabled (no DSN, or non-production) the layout renders no script at all, so the
 * accessor is simply never triggered and no DSN reaches the browser.
 */
export const initClientSentryFromRuntimeConfig = () => {
  if (typeof window === "undefined") {
    return;
  }

  const injectedConfig = window[SENTRY_CLIENT_RUNTIME_CONFIG_KEY];

  if (injectedConfig) {
    initSentry(injectedConfig);
    return;
  }

  let config: TSentryClientRuntimeConfig | undefined;

  Object.defineProperty(window, SENTRY_CLIENT_RUNTIME_CONFIG_KEY, {
    configurable: true,
    enumerable: true,
    get: () => config,
    set: (value: TSentryClientRuntimeConfig | undefined) => {
      config = value;

      if (value) {
        initSentry(value);
      }
    },
  });
};
