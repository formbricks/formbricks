// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  isUnexpectedServerActionResponseError,
  registerUnexpectedServerActionResponseListener,
} from "@/lib/utils/unexpected-server-action-response";

/**
 * Fixtures in the shape Next.js gives these errors. That they match what the installed Next.js really
 * raises is pinned separately, by `unexpected-server-action-response.next-contract.test.ts`.
 */
const unexpectedResponseError = (message = "An unexpected response was received from the server.") =>
  Object.assign(new Error(message), { __NEXT_ERROR_CODE: "E394" });
const redirectError = () =>
  Object.assign(new Error("NEXT_REDIRECT"), {
    __NEXT_ERROR_CODE: "E394",
    digest: "NEXT_REDIRECT;push;/workspaces/w1/surveys;307;",
  });
const staleActionError = () =>
  Object.assign(new Error('Server Action "7f" was not found on the server.'), {
    name: "UnrecognizedActionError",
    __NEXT_ERROR_CODE: "E715",
  });

describe("isUnexpectedServerActionResponseError", () => {
  test("recognizes the rejection for a non-Flight action response", () => {
    expect(isUnexpectedServerActionResponseError(unexpectedResponseError())).toBe(true);
  });

  test("matches the code, not the message, which can be the server's own text", () => {
    expect(isUnexpectedServerActionResponseError(unexpectedResponseError("upstream connect error"))).toBe(
      true
    );
    expect(
      isUnexpectedServerActionResponseError(new Error("An unexpected response was received from the server."))
    ).toBe(false);
  });

  test("leaves Next's control-flow errors alone, though redirect() shares the code", () => {
    expect(isUnexpectedServerActionResponseError(redirectError())).toBe(false);
  });

  test("leaves a stale action to the reload prompt", () => {
    expect(isUnexpectedServerActionResponseError(staleActionError())).toBe(false);
  });

  test("rejects values that are not errors", () => {
    expect(isUnexpectedServerActionResponseError({ __NEXT_ERROR_CODE: "E394" })).toBe(false);
    expect(isUnexpectedServerActionResponseError("E394")).toBe(false);
    expect(isUnexpectedServerActionResponseError(undefined)).toBe(false);
  });
});

describe("registerUnexpectedServerActionResponseListener", () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  /** jsdom has no `PromiseRejectionEvent`, so this builds the same shape the browser dispatches. */
  const dispatchUnhandledRejection = (reason: unknown) => {
    const event = Object.assign(new Event("unhandledrejection", { cancelable: true }), { reason });
    window.dispatchEvent(event);
    return event;
  };

  test("reports an unexpected-response rejection nothing else handled", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test("keeps the rejection unhandled so the console and Sentry still see it", () => {
    unsubscribers.push(registerUnexpectedServerActionResponseListener(vi.fn()));

    const event = dispatchUnhandledRejection(unexpectedResponseError());

    expect(event.defaultPrevented).toBe(false);
  });

  test("reports every occurrence, not just the first", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(unexpectedResponseError());
    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  test("ignores every other rejection", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(new Error("boom"));
    dispatchUnhandledRejection(staleActionError());
    dispatchUnhandledRejection(redirectError());

    expect(onFailure).not.toHaveBeenCalled();
  });

  test("stops reporting once unsubscribed", () => {
    const onFailure = vi.fn();
    registerUnexpectedServerActionResponseListener(onFailure)();

    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).not.toHaveBeenCalled();
  });
});
