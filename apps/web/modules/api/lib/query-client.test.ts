import { describe, expect, test } from "vitest";
import { QUERY_RETRY, QUERY_STALE_TIME_MS, makeQueryClient } from "./query-client";
import { V3ApiError } from "./v3-client";

describe("QUERY_RETRY", () => {
  const { retry } = QUERY_RETRY;

  test.each([400, 401, 403, 404, 422])("never retries a %i: it answers the same way every time", (status) => {
    expect(retry(0, new V3ApiError({ status, detail: "x" }))).toBe(false);
  });

  test("retries a 5xx, a request that got no answer, and a failed fetch, at most three times", () => {
    const serverError = new V3ApiError({ status: 503, detail: "x" });
    const noAnswer = new V3ApiError({ status: 0, detail: "" });
    const networkError = new TypeError("Failed to fetch");

    expect(retry(0, serverError)).toBe(true);
    expect(retry(1, noAnswer)).toBe(true);
    expect(retry(2, networkError)).toBe(true);
    expect(retry(3, serverError)).toBe(false);
  });

  test("waits out a 429 that asks for a short wait, but not a spent budget", () => {
    expect(retry(0, new V3ApiError({ status: 429, detail: "busy", retryAfter: 1 }))).toBe(true);
    expect(retry(0, new V3ApiError({ status: 429, detail: "spent", retryAfter: 1800 }))).toBe(false);
  });
});

describe("makeQueryClient", () => {
  test("applies the house defaults: non-zero stale time, the retry rule, and no mutation retries", () => {
    const options = makeQueryClient().getDefaultOptions();

    expect(options.queries?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(options.queries?.retry).toBe(QUERY_RETRY.retry);
    expect(options.queries?.retryDelay).toBe(QUERY_RETRY.retryDelay);
    expect(options.mutations?.retry).toBeUndefined();
  });

  test("returns a fresh client each time, so no cache is ever shared between requests", () => {
    expect(makeQueryClient()).not.toBe(makeQueryClient());
  });
});
