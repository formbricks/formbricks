import { APICallError, RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { classifyAIProviderError } from "./errors";

const makeApiError = (statusCode: number, responseHeaders?: Record<string, string>): APICallError =>
  new APICallError({
    message: "provider error",
    url: "https://vertex.example/generate",
    requestBodyValues: {},
    statusCode,
    responseHeaders,
    isRetryable: statusCode >= 500,
  });

describe("classifyAIProviderError", () => {
  test("flags a direct 429 APICallError as quota-exhausted and retryable", () => {
    const info = classifyAIProviderError(makeApiError(429, { "retry-after": "30" }));
    expect(info).toEqual({
      isQuotaExhausted: true,
      isRetryable: true,
      statusCode: 429,
      retryAfterSeconds: 30,
    });
  });

  test("does not flag a non-429 APICallError as quota, preserving its retryable flag", () => {
    const info = classifyAIProviderError(makeApiError(500));
    expect(info).toMatchObject({ isQuotaExhausted: false, isRetryable: true, statusCode: 500 });
    expect(info?.retryAfterSeconds).toBeUndefined();
  });

  test("ignores a malformed retry-after header", () => {
    const info = classifyAIProviderError(makeApiError(429, { "retry-after": "soon" }));
    expect(info?.isQuotaExhausted).toBe(true);
    expect(info?.retryAfterSeconds).toBeUndefined();
  });

  test("unwraps a RetryError to find the underlying 429", () => {
    const retryError = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [makeApiError(503), makeApiError(429, { "retry-after": "12" })],
    });
    const info = classifyAIProviderError(retryError);
    expect(info).toMatchObject({ isQuotaExhausted: true, statusCode: 429, retryAfterSeconds: 12 });
  });

  test("falls back to the RetryError reason when no APICallError is wrapped", () => {
    const retryError = new RetryError({
      message: "Failed after 3 attempts",
      reason: "maxRetriesExceeded",
      errors: [new Error("network down")],
    });
    expect(classifyAIProviderError(retryError)).toEqual({ isQuotaExhausted: false, isRetryable: true });
  });

  test.each(["errorNotRetryable", "abort"] as const)(
    "treats a wrapper-only RetryError with reason=%s as non-retryable",
    (reason) => {
      const retryError = new RetryError({ message: "stopped", reason, errors: [new Error("x")] });
      expect(classifyAIProviderError(retryError)).toEqual({ isQuotaExhausted: false, isRetryable: false });
    }
  );

  test("parses an HTTP-date retry-after header into a non-negative delay", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const info = classifyAIProviderError(makeApiError(429, { "retry-after": future }));
    expect(info?.isQuotaExhausted).toBe(true);
    expect(info?.retryAfterSeconds).toBeGreaterThan(0);
    expect(info?.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  test("leaves retryAfterSeconds undefined when no retry-after header is present", () => {
    const info = classifyAIProviderError(makeApiError(429));
    expect(info?.isQuotaExhausted).toBe(true);
    expect(info?.retryAfterSeconds).toBeUndefined();
  });

  test("returns undefined for errors that aren't provider API/retry errors", () => {
    expect(classifyAIProviderError(new Error("boom"))).toBeUndefined();
    expect(classifyAIProviderError(undefined)).toBeUndefined();
  });
});
