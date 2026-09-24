import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * The header the server sets on the response to an action id it does not recognise. Next.js reads it
 * in `client/components/router-reducer/reducers/server-action-reducer` and turns it into the
 * rejection below, so observing it catches a stale action before any call site's `catch` can consume
 * the rejection it becomes.
 */
const NEXT_ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";

/**
 * The code Next.js stamps onto that rejection, alongside the `UnrecognizedActionError` name. Checking
 * the name on its own would accept any application error that happens to carry it, and a false
 * positive costs twice: it raises the reload prompt over a working page, and drops a real error from
 * Sentry in `beforeSend`.
 */
const NEXT_UNRECOGNIZED_ACTION_ERROR_CODE = "E715";

/**
 * A server action id is minted at build time, so it only exists in the deployment that compiled it.
 * A tab that was loaded before a deploy keeps its old bundle and therefore its old action ids: the
 * first action it invokes afterwards is rejected by the new server with `UnrecognizedActionError`
 * (`failed-to-find-server-action`). Next.js surfaces that as a rejected promise from the action
 * call itself, so it either lands as an unhandled rejection -- past `app/error.tsx`, so the user's
 * click simply does nothing -- or is swallowed by whatever `try/catch` the call site wraps it in
 * (ENG-2330).
 *
 * The `instanceof` check Next.js ships is the primary test. The fallback keeps this working if the
 * rejection reaches us without that class identity (a second copy of the client runtime, or an error
 * rethrown through a boundary that reconstructs it), and demands both of the framework's markers so
 * that an unrelated error cannot satisfy it.
 */
export const isStaleServerActionError = (error: unknown): boolean => {
  if (unstable_isUnrecognizedActionError(error)) {
    return true;
  }

  return (
    error instanceof Error &&
    error.name === "UnrecognizedActionError" &&
    "__NEXT_ERROR_CODE" in error &&
    error.__NEXT_ERROR_CODE === NEXT_UNRECOGNIZED_ACTION_ERROR_CODE
  );
};

const subscribers = new Set<() => void>();

/**
 * Latches once a stale action has been seen. The bundle cannot become current again without a
 * reload, so a subscriber that mounts after the fact still has to prompt -- otherwise the one
 * signal that matters is lost to a mount-order race with the call site that reported it.
 */
let hasSeenStaleAction = false;

const notifyStaleAction = () => {
  hasSeenStaleAction = true;
  // Copied: a subscriber is free to unsubscribe while being notified.
  const currentSubscribers = [...subscribers];
  for (const subscriber of currentSubscribers) {
    subscriber();
  }
};

/**
 * Reports `error` as a stale server action rejection and returns whether it was one.
 *
 * This is the entry point for call sites that catch their own action rejections and want to suppress
 * their generic failure message: an `UnrecognizedActionError` consumed by a `try/catch` never reaches
 * `unhandledrejection`, so the catch has to delegate here to know not to show one. The prompt itself
 * no longer depends on that delegation -- the response observer below raises it for every stale
 * action, caught or not.
 *
 * ```ts
 * } catch (error) {
 *   if (reportStaleServerActionError(error)) {
 *     return;
 *   }
 *   toast.error(t("..."));
 * }
 * ```
 */
export const reportStaleServerActionError = (error: unknown): boolean => {
  if (!isStaleServerActionError(error)) {
    return false;
  }

  notifyStaleAction();

  return true;
};

/**
 * Wraps `window.fetch` to watch every response for `NEXT_ACTION_NOT_FOUND_HEADER`.
 *
 * `unhandledrejection` only sees rejections nobody consumed, and delegating from every `catch` would
 * mean touching every call site that wraps an action (72 components at the time of writing) and
 * keeping them all delegating forever. The header arrives before Next.js has even constructed the
 * rejection, so one wrapper covers every call site including the ones that swallow it -- those still
 * show their own error message, but the reload prompt now comes up behind it.
 *
 * Headers are read without touching the body, and the response is handed back untouched, so a
 * streamed or RSC response is unaffected. Reference counted because the wrapper is global while the
 * subscriptions that need it are not.
 */
let installedObserver: { original: typeof window.fetch; patched: typeof window.fetch } | null = null;
let observerSubscriptions = 0;

const installResponseObserver = () => {
  observerSubscriptions += 1;
  if (installedObserver) {
    return;
  }

  const original = window.fetch;
  const patched: typeof window.fetch = async (...args) => {
    const response = await original(...args);
    if (response.headers.get(NEXT_ACTION_NOT_FOUND_HEADER) === "1") {
      notifyStaleAction();
    }
    return response;
  };

  window.fetch = patched;
  installedObserver = { original, patched };
};

const uninstallResponseObserver = () => {
  observerSubscriptions = Math.max(0, observerSubscriptions - 1);
  if (observerSubscriptions > 0 || !installedObserver) {
    return;
  }

  // Left in place if something else has wrapped `fetch` since: restoring the original would drop
  // that wrapper along with ours.
  if (window.fetch === installedObserver.patched) {
    window.fetch = installedObserver.original;
  }
  installedObserver = null;
};

/**
 * Subscribes `onStaleAction` to stale server actions, from all three directions: the response header
 * the observer above watches for, whatever `reportStaleServerActionError` is handed by a call site's
 * own `catch`, and the rejections that reach `unhandledrejection` because no call site consumed them.
 * It is expected to prompt the user to reload into the current deployment.
 *
 * `preventDefault()` marks the rejection as handled, so the browser stops logging it as unhandled.
 * It does not stop Sentry -- `preventDefault` never cancels other listeners -- so the same errors
 * are dropped in `beforeSend` (`lib/sentry/init-client-sentry.ts`) to keep them off the error budget.
 *
 * Returns the unsubscribe function so callers can pass it straight back from a `useEffect`.
 */
export const registerStaleServerActionListener = (onStaleAction: () => void): (() => void) => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    if (reportStaleServerActionError(event.reason)) {
      event.preventDefault();
    }
  };

  subscribers.add(onStaleAction);
  window.addEventListener("unhandledrejection", handleRejection);
  installResponseObserver();

  if (hasSeenStaleAction) {
    onStaleAction();
  }

  return () => {
    subscribers.delete(onStaleAction);
    window.removeEventListener("unhandledrejection", handleRejection);
    uninstallResponseObserver();
  };
};
