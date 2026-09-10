import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * A server action id is minted at build time, so it only exists in the deployment that compiled it.
 * A tab that was loaded before a deploy keeps its old bundle and therefore its old action ids: the
 * first action it invokes afterwards is rejected by the new server with `UnrecognizedActionError`
 * (`failed-to-find-server-action`). Next.js surfaces that as a rejected promise from the action
 * call itself, so it either lands as an unhandled rejection -- past `app/error.tsx`, so the user's
 * click simply does nothing -- or is swallowed by whatever `try/catch` the call site wraps it in
 * (ENG-2330).
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

const subscribers = new Set<() => void>();

/**
 * Latches once a stale action has been seen. The bundle cannot become current again without a
 * reload, so a subscriber that mounts after the fact still has to prompt -- otherwise the one
 * signal that matters is lost to a mount-order race with the call site that reported it.
 */
let hasSeenStaleAction = false;

/**
 * Reports `error` as a stale server action rejection and returns whether it was one.
 *
 * This is the entry point for call sites that catch their own action rejections: an
 * `UnrecognizedActionError` consumed by a `try/catch` never reaches `unhandledrejection`, so the
 * catch has to delegate here instead of showing its own generic failure message.
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

  hasSeenStaleAction = true;
  // Copied: a subscriber is free to unsubscribe while being notified.
  for (const subscriber of [...subscribers]) {
    subscriber();
  }

  return true;
};

/**
 * Subscribes `onStaleAction` to stale server action rejections, from both directions: whatever
 * `reportStaleServerActionError` is handed by a call site's own `catch`, and the rejections that
 * reach `unhandledrejection` because no call site consumed them. It is expected to prompt the user
 * to reload into the current deployment.
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

  if (hasSeenStaleAction) {
    onStaleAction();
  }

  return () => {
    subscribers.delete(onStaleAction);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
};
