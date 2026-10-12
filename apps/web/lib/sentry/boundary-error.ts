import * as Sentry from "@sentry/nextjs";
import { isExpectedError } from "@formbricks/types/errors";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";

/**
 * Reports an error caught by a route error boundary (`error.tsx`, `global-error.tsx`).
 *
 * An error with a `digest` was thrown on the server, where `onRequestError` in `instrumentation.ts`
 * already reported it, or skipped it as expected. In production it reaches the browser with its name
 * and message stripped, so `isExpectedError` cannot recognise it here: reporting it again would send
 * every server failure twice, and the expected ones the server chose to skip once.
 */
export const reportBoundaryError = (error: Error & { digest?: string }): void => {
  if (IS_DEVELOPMENT_BUILD) {
    console.error(error.message);
    return;
  }

  if (error.digest || isExpectedError(error)) return;

  Sentry.captureException(error);
};
