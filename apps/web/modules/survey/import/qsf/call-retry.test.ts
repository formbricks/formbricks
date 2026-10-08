import { APICallError } from "ai";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { QSF_MAX_CALL_RETRIES, decideQsfRetry, waitForRetry } from "./call-retry";

const providerError = (statusCode: number, headers: Record<string, string> = {}) =>
  new APICallError({
    message: "provider failure",
    url: "https://provider.example.com/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseHeaders: headers,
  });

const decide = (error: unknown, attempt = 0, remainingMs = 45_000) =>
  decideQsfRetry({ error, attempt, remainingMs, minAttemptMs: 5_000, random: () => 1 });

describe("decideQsfRetry", () => {
  test("waits out a 429 whose Retry-After leaves time for another attempt", () => {
    expect(decide(new TooManyRequestsError("ai_quota_exceeded", 3))).toEqual({
      kind: "retry",
      delayMs: 3_000,
    });
  });

  test("lets a 429 through when its Retry-After does not fit the call's time", () => {
    expect(decide(new TooManyRequestsError("ai_quota_exceeded", 41))).toEqual({ kind: "propagate" });
  });

  test("reads the Retry-After of a provider's own 429 from its response headers", () => {
    expect(decide(providerError(429, { "retry-after": "4" }))).toEqual({ kind: "retry", delayMs: 4_000 });
    expect(decide(providerError(429, { "retry-after": "41" }))).toEqual({ kind: "propagate" });
  });

  test("backs a 429 without a Retry-After off like a 5xx, and lets it through past the time", () => {
    expect(decide(new TooManyRequestsError("ai_quota_exceeded"))).toEqual({ kind: "retry", delayMs: 2_000 });
    expect(decide(new TooManyRequestsError("ai_quota_exceeded"), 0, 6_000)).toEqual({ kind: "propagate" });
  });

  test("takes a negative Retry-After as missing, backing off instead of retrying at once", () => {
    expect(decide(new TooManyRequestsError("ai_quota_exceeded", -5))).toEqual({
      kind: "retry",
      delayMs: 2_000,
    });
    expect(decide(providerError(503, { "retry-after": "-1" }))).toEqual({ kind: "retry", delayMs: 2_000 });
  });

  test("backs a 5xx off exponentially, with jitter", () => {
    expect(decide(providerError(503), 0)).toEqual({ kind: "retry", delayMs: 2_000 });
    expect(decide(providerError(503), 1)).toEqual({ kind: "retry", delayMs: 4_000 });
    const low = decideQsfRetry({
      error: providerError(503),
      attempt: 1,
      remainingMs: 45_000,
      minAttemptMs: 5_000,
      random: () => 0,
    });
    expect(low).toEqual({ kind: "retry", delayMs: 2_000 });
  });

  test("calls a 5xx with no time left to retry it a timeout, so its chunk is split", () => {
    expect(decide(providerError(503), 0, 6_000)).toEqual({ kind: "timed_out" });
  });

  test("stops after the SDK's default number of retries", () => {
    expect(decide(providerError(503), QSF_MAX_CALL_RETRIES)).toEqual({ kind: "propagate" });
    expect(decide(new TooManyRequestsError("ai_quota_exceeded", 1), QSF_MAX_CALL_RETRIES)).toEqual({
      kind: "propagate",
    });
  });

  test.each([
    ["a 400", providerError(400)],
    ["a 401", providerError(401)],
    ["an error that is not the provider's", new Error("boom")],
  ])("never retries %s", (_case, error) => {
    expect(decide(error)).toEqual({ kind: "propagate" });
  });
});

describe("waitForRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("waits the delay", async () => {
    vi.useFakeTimers();
    let done = false;
    const waited = waitForRetry(3_000, new AbortController().signal).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(2_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waited;
    expect(done).toBe(true);
  });

  test("rejects with the signal's reason the moment it aborts, or at once when it already has", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new DOMException("Stopped", "AbortError");
    const waited = waitForRetry(60_000, controller.signal).catch((error: unknown) => error);

    controller.abort(reason);

    expect(await waited).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
    await expect(waitForRetry(1_000, controller.signal)).rejects.toBe(reason);
  });
});
