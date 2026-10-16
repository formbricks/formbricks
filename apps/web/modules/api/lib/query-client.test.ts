import { describe, expect, test } from "vitest";
import { QUERY_STALE_TIME_MS, makeQueryClient, shouldRetryQuery } from "./query-client";
import { V3ApiError } from "./v3-client";

describe("shouldRetryQuery", () => {
  test.each([400, 401, 403, 404, 422, 429])(
    "never retries a %i: it answers the same way every time",
    (status) => {
      expect(shouldRetryQuery(0, new V3ApiError({ status, detail: "x" }))).toBe(false);
    }
  );

  test("retries a 5xx and a network failure, at most twice", () => {
    const serverError = new V3ApiError({ status: 503, detail: "x" });
    const networkError = new TypeError("Failed to fetch");

    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);
    expect(shouldRetryQuery(2, serverError)).toBe(false);
  });
});

describe("makeQueryClient", () => {
  test("applies the house defaults: non-zero stale time, the retry rule, and no mutation retries", () => {
    const options = makeQueryClient().getDefaultOptions();

    expect(options.queries?.staleTime).toBe(QUERY_STALE_TIME_MS);
    expect(options.queries?.retry).toBe(shouldRetryQuery);
    expect(options.mutations?.retry).toBeUndefined();
  });

  test("returns a fresh client each time, so no cache is ever shared between requests", () => {
    expect(makeQueryClient()).not.toBe(makeQueryClient());
  });
});
