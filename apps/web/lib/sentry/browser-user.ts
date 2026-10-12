import * as Sentry from "@sentry/nextjs";

/**
 * Identifies the signed-in user to the browser Sentry client by opaque id only -- never email, name
 * or IP (`sendDefaultPii` stays false). Returns the cleanup that clears it again, so leaving the
 * authenticated app tree (logout, client navigation to a public page) stops attributing errors.
 * Safe before or without `Sentry.init`: the calls only write scope data that no client sends.
 */
export const setBrowserSentryUser = (userId: string): (() => void) => {
  Sentry.setUser({ id: userId });

  return () => {
    Sentry.setUser(null);
  };
};
