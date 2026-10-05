import * as Sentry from "@sentry/nextjs";
import type { Event, EventHint } from "@sentry/nextjs";

/**
 * Attaches the opaque user id of an authenticated request to that request's server error event, so
 * Sentry issues report affected users (ENG-2326). Only `{ id }` is ever sent -- no email, name or IP.
 *
 * Why not `Sentry.setUser` / `withScope(scope => scope.setUser(...))`: the server SDK is started with
 * `skipOpenTelemetrySetup: true`, so Sentry's `SentryContextManager` is never registered (it is only
 * created in `@sentry/node`'s `initOpenTelemetry`). The OpenTelemetry async context strategy then has
 * nothing that forks scopes: `withScope` hands back the process-wide default scope, and events read
 * the scope asynchronously after capture. Any user written to a scope would leak onto other
 * requests' errors. Instead the id is keyed by the exact error object and applied per event by a
 * global event processor, which never mutates shared scope state.
 */

type TRequestHeaders = Record<string, string | string[] | undefined>;
type TLookupUserId = (cookieHeader: string) => Promise<string | null | undefined>;

/** Upper bound on the session lookup; it only runs on the error path and must never stall reporting. */
export const REQUEST_ERROR_USER_LOOKUP_TIMEOUT_MS = 500;

const userIdByError = new WeakMap<object, string>();
let isProcessorRegistered = false;

const isObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

export const applyRequestErrorUser = (event: Event, hint: EventHint): Event => {
  const error = hint.originalException;
  const userId = isObject(error) ? userIdByError.get(error) : undefined;

  return userId ? { ...event, user: { id: userId } } : event;
};

const ensureProcessorRegistered = () => {
  if (isProcessorRegistered) {
    return;
  }

  Sentry.getGlobalScope().addEventProcessor(applyRequestErrorUser);
  isProcessorRegistered = true;
};

const getCookieHeader = (headers: TRequestHeaders): string | null => {
  const cookie = headers.cookie;
  if (Array.isArray(cookie)) {
    return cookie.length > 0 ? cookie.join("; ") : null;
  }

  return cookie || null;
};

const lookupWithTimeout = async (lookupUserId: TLookupUserId, cookieHeader: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), REQUEST_ERROR_USER_LOOKUP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([lookupUserId(cookieHeader), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Resolves the session behind a failing request and remembers its user id for that error's event.
 * Fail-safe: no cookie, no session, a throwing or slow lookup all leave the error without a user,
 * and nothing here ever throws, so the capture that follows always happens.
 */
export const tagRequestErrorWithUser = async (
  error: unknown,
  headers: TRequestHeaders,
  lookupUserId: TLookupUserId
): Promise<void> => {
  try {
    // A thrown primitive cannot be keyed, and a user already recorded for this error object wins --
    // mirroring Sentry, which only reports the first capture of a given error object.
    if (!isObject(error) || userIdByError.has(error)) {
      return;
    }

    const cookieHeader = getCookieHeader(headers);
    if (!cookieHeader) {
      return;
    }

    const userId = await lookupWithTimeout(lookupUserId, cookieHeader);
    if (typeof userId !== "string" || userId.length === 0 || userIdByError.has(error)) {
      return;
    }

    ensureProcessorRegistered();
    userIdByError.set(error, userId);
  } catch {
    // Reporting the error matters more than attributing it; capture proceeds without a user.
  }
};
