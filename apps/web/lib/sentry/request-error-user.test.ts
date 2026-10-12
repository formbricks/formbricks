import type { Event, EventHint } from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockAddEventProcessor = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nextjs", () => ({
  getGlobalScope: () => ({ addEventProcessor: mockAddEventProcessor }),
}));

const importHelper = async () => import("@/lib/sentry/request-error-user");

const COOKIE_HEADERS = { cookie: "formbricks.session_token=signed" };
const EVENT: Event = { event_id: "e1", user: { ip_address: "{{auto}}", email: "x@example.com" } };

describe("request-error-user", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("applies only the user id to the event of the tagged error", async () => {
    const { tagRequestErrorWithUser, applyRequestErrorUser } = await importHelper();
    const error = new Error("boom");
    const lookup = vi.fn().mockResolvedValue("user-1");

    await tagRequestErrorWithUser(error, COOKIE_HEADERS, lookup);

    expect(lookup).toHaveBeenCalledWith("formbricks.session_token=signed");
    expect(mockAddEventProcessor).toHaveBeenCalledWith(applyRequestErrorUser);
    expect(applyRequestErrorUser(EVENT, { originalException: error }).user).toEqual({ id: "user-1" });
  });

  test("leaves every other error's event untouched, so no user leaks across requests", async () => {
    const { tagRequestErrorWithUser, applyRequestErrorUser } = await importHelper();
    await tagRequestErrorWithUser(new Error("a"), COOKIE_HEADERS, vi.fn().mockResolvedValue("user-1"));

    const otherHints: EventHint[] = [{ originalException: new Error("b") }, { originalException: "str" }, {}];
    for (const hint of otherHints) {
      expect(applyRequestErrorUser(EVENT, hint)).toBe(EVENT);
    }
  });

  test("does not look anything up for a request without cookies", async () => {
    const { tagRequestErrorWithUser, applyRequestErrorUser } = await importHelper();
    const error = new Error("anon");
    const lookup = vi.fn();

    await tagRequestErrorWithUser(error, {}, lookup);

    expect(lookup).not.toHaveBeenCalled();
    expect(applyRequestErrorUser(EVENT, { originalException: error })).toBe(EVENT);
  });

  test("joins a multi-valued cookie header", async () => {
    const { tagRequestErrorWithUser } = await importHelper();
    const lookup = vi.fn().mockResolvedValue(null);

    await tagRequestErrorWithUser(new Error("x"), { cookie: ["a=1", "b=2"] }, lookup);

    expect(lookup).toHaveBeenCalledWith("a=1; b=2");
  });

  test.each([
    ["no session", () => Promise.resolve(null)],
    ["a throwing lookup", () => Promise.reject(new Error("db down"))],
  ])("sets no user and does not throw for %s", async (_, impl) => {
    const { tagRequestErrorWithUser, applyRequestErrorUser } = await importHelper();
    const error = new Error("x");

    await expect(tagRequestErrorWithUser(error, COOKIE_HEADERS, impl)).resolves.toBeUndefined();

    expect(applyRequestErrorUser(EVENT, { originalException: error })).toBe(EVENT);
  });

  test("gives up on a slow lookup after the timeout", async () => {
    vi.useFakeTimers();
    const { tagRequestErrorWithUser, applyRequestErrorUser, REQUEST_ERROR_USER_LOOKUP_TIMEOUT_MS } =
      await importHelper();
    const error = new Error("x");

    const pending = tagRequestErrorWithUser(error, COOKIE_HEADERS, () => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(REQUEST_ERROR_USER_LOOKUP_TIMEOUT_MS);
    await pending;

    expect(applyRequestErrorUser(EVENT, { originalException: error })).toBe(EVENT);
  });

  test("keeps the first user recorded for an error object shared by two requests", async () => {
    const { tagRequestErrorWithUser, applyRequestErrorUser } = await importHelper();
    const sharedError = new Error("cached");

    await tagRequestErrorWithUser(sharedError, COOKIE_HEADERS, vi.fn().mockResolvedValue("user-1"));
    await tagRequestErrorWithUser(sharedError, COOKIE_HEADERS, vi.fn().mockResolvedValue("user-2"));

    expect(applyRequestErrorUser(EVENT, { originalException: sharedError }).user).toEqual({ id: "user-1" });
    expect(mockAddEventProcessor).toHaveBeenCalledTimes(1);
  });
});
