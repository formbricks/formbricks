/**
 * The code Next.js stamps on the rejection it raises when a server action's response is neither a
 * Flight (RSC) payload nor a redirect (`client/components/router-reducer/reducers/server-action-reducer`).
 *
 * That happens when something in front of the app answers the action POST: a load balancer's 502 or
 * 504 page, a CDN or WAF error page, an empty body (ENG-2899). Next.js's own server never answers a
 * fetch action that way -- its failures come back as Flight -- so this rejection means the action's
 * outcome is unknown: the request may never have reached the app, or it may have run and its
 * response been lost.
 *
 * The code is matched rather than the message because the message is not stable: Next.js passes the
 * body through as the message when the response is a 4xx/5xx `text/plain`.
 *
 * The code alone is not unique, though: `E394` is what Next.js stamps on every `new Error(<dynamic
 * message>)` it throws, including the `NEXT_REDIRECT` error a server action's `redirect()` rejects
 * with. Next.js marks each of its control-flow throws (`redirect()`, `notFound()`, ...) with a
 * `digest`, which is how its own `isRedirectError` recognises them, and the unexpected-response
 * rejection carries none -- so a `digest` rules an error out.
 */
const NEXT_UNEXPECTED_ACTION_RESPONSE_ERROR_CODE = "E394";

export const isUnexpectedServerActionResponseError = (error: unknown): error is Error =>
  error instanceof Error &&
  !("digest" in error) &&
  "__NEXT_ERROR_CODE" in error &&
  error.__NEXT_ERROR_CODE === NEXT_UNEXPECTED_ACTION_RESPONSE_ERROR_CODE;

/**
 * Calls `onFailure` for every unexpected-response rejection that no call site consumed.
 *
 * This is the last line of defence, not the error handling: a call site that catches its action's
 * rejection is expected to tell the user itself, and it is left alone here so the user is not told
 * twice. What reaches `unhandledrejection` is the case where nothing would otherwise be shown at
 * all -- the click simply does nothing.
 *
 * The rejection is deliberately not `preventDefault()`ed. Unlike a stale action (see
 * `stale-server-action.ts`), this is a real failure: it should stay visible as unhandled in the
 * console and keep reaching Sentry, which listens for it independently.
 *
 * Returns the unsubscribe function so callers can pass it straight back from a `useEffect`.
 */
export const registerUnexpectedServerActionResponseListener = (onFailure: () => void): (() => void) => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (isUnexpectedServerActionResponseError(event.reason)) {
      onFailure();
    }
  };

  window.addEventListener("unhandledrejection", handleRejection);

  return () => {
    window.removeEventListener("unhandledrejection", handleRejection);
  };
};
