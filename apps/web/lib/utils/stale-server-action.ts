import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * A server action id is minted at build time, so it only exists in the deployment that compiled it.
 * A tab that was loaded before a deploy keeps its old bundle and therefore its old action ids: the
 * first action it invokes afterwards is rejected by the new server with `UnrecognizedActionError`
 * (`failed-to-find-server-action`). Next.js surfaces that as a rejected promise from the action
 * call itself, and because no call site awaits it in a try/catch it lands as an unhandled rejection
 * -- past `app/error.tsx`, so the user's click simply does nothing (ENG-2330).
 *
 * The `instanceof` check Next.js ships is the primary test; the name check keeps this working if the
 * rejection reaches us without that class identity (a second copy of the client runtime, or an error
 * rethrown through a boundary that reconstructs it).
 */
export const isStaleServerActionError = (error: unknown): boolean => {
  if (unstable_isUnrecognizedActionError(error)) {
    return true;
  }

  return error instanceof Error && error.name === "UnrecognizedActionError";
};

/**
 * Listens for stale server action rejections anywhere in the app and hands them to `onStaleAction`,
 * which is expected to prompt the user to reload into the current deployment.
 *
 * `preventDefault()` marks the rejection as handled, so the browser stops logging it as unhandled.
 * It does not stop Sentry -- `preventDefault` never cancels other listeners -- so the same errors
 * are dropped in `beforeSend` (`lib/sentry/init-client-sentry.ts`) to keep them off the error budget.
 *
 * Returns the unsubscribe function so callers can pass it straight back from a `useEffect`.
 */
export const registerStaleServerActionListener = (onStaleAction: () => void): (() => void) => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (!isStaleServerActionError(event.reason)) {
      return;
    }

    event.preventDefault();
    onStaleAction();
  };

  window.addEventListener("unhandledrejection", handleRejection);

  return () => window.removeEventListener("unhandledrejection", handleRejection);
};
