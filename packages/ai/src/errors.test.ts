import { APICallError, RetryError } from "ai";
import { describe, expect, test } from "vitest";
import { AIOAuthTokenError, classifyAIProviderError } from "./errors";
import { createOAuthTokenSource } from "./oauth-token";

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
      isAuthFailure: false,
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
    expect(classifyAIProviderError(retryError)).toEqual({
      isAuthFailure: false,
      isQuotaExhausted: false,
      isRetryable: true,
    });
  });

  test.each(["errorNotRetryable", "abort"] as const)(
    "treats a wrapper-only RetryError with reason=%s as non-retryable",
    (reason) => {
      const retryError = new RetryError({ message: "stopped", reason, errors: [new Error("x")] });
      expect(classifyAIProviderError(retryError)).toEqual({
        isAuthFailure: false,
        isQuotaExhausted: false,
        isRetryable: false,
      });
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

describe("AIOAuthTokenError", () => {
  const SECRET_SENTINEL = "SECRET_SENTINEL_value";
  const TOKEN_SENTINEL = "TOKEN_SENTINEL_value";
  const CLIENT_ID_SENTINEL = "CLIENT_ID_SENTINEL_value";

  // Mirrors what an error reporter such as @posthog/ai's serializeError reaches: every own key,
  // message, stack and the cause chain.
  const collectSerializedSurface = (error: Error): string => {
    const ownValues = Object.keys(error).map((key) =>
      String((error as unknown as Record<string, unknown>)[key])
    );
    return [error.message, error.stack ?? "", JSON.stringify(error), ...ownValues].join("\n");
  };

  test.each([
    {
      label: "a 401 whose body echoes the credentials",
      response: () =>
        new Response(
          JSON.stringify({
            error: "invalid_client",
            client_secret: SECRET_SENTINEL,
            access_token: TOKEN_SENTINEL,
          }),
          { status: 401 }
        ),
    },
    {
      label: "a 200 carrying a MAC token",
      response: () =>
        new Response(JSON.stringify({ access_token: TOKEN_SENTINEL, token_type: "MAC" }), { status: 200 }),
    },
  ])("carries no secret, token or client id for $label", async ({ response }) => {
    const source = createOAuthTokenSource(
      {
        tokenUrl: `https://idp.example.internal/tenant/${CLIENT_ID_SENTINEL}/token?secret=${SECRET_SENTINEL}`,
        clientId: CLIENT_ID_SENTINEL,
        clientSecret: SECRET_SENTINEL,
        authStyle: "post",
      },
      { fetch: () => Promise.resolve(response()) }
    );

    const error = await source.getToken().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIOAuthTokenError);
    const tokenError = error as AIOAuthTokenError;
    expect(tokenError.cause).toBeUndefined();
    expect(tokenError.tokenUrlHost).toBe("idp.example.internal");

    const surface = collectSerializedSurface(tokenError);
    expect(surface).not.toContain(SECRET_SENTINEL);
    expect(surface).not.toContain(TOKEN_SENTINEL);
    expect(surface).not.toContain(CLIENT_ID_SENTINEL);
    // The whole own-key surface, pinned: a new field here is a new thing reporters will serialize.
    expect(Object.keys(tokenError).sort()).toEqual(["code", "name", "statusCode", "tokenUrlHost"]);
  });

  test.each([
    ["a rejected token request", "token_request_failed", 401],
    ["an unusable token response", "token_response_invalid", undefined],
  ] as const)("classifies %s as a non-retryable auth failure", (_label, code, statusCode) => {
    expect(
      classifyAIProviderError(new AIOAuthTokenError(code, { statusCode, tokenUrlHost: "idp.example" }))
    ).toMatchObject({ isAuthFailure: true, isQuotaExhausted: false, isRetryable: false });
  });

  test.each([
    ["a timeout", "token_endpoint_timeout", undefined],
    ["an unreachable endpoint", "token_endpoint_unreachable", undefined],
    ["a 5xx", "token_request_failed", 503],
  ] as const)("classifies %s as a retryable outage, not an auth failure", (_label, code, statusCode) => {
    expect(
      classifyAIProviderError(new AIOAuthTokenError(code, { statusCode, tokenUrlHost: "idp.example" }))
    ).toMatchObject({ isAuthFailure: false, isQuotaExhausted: false, isRetryable: true });
  });
});

describe("classifyAIProviderError isAuthFailure", () => {
  test.each([
    [401, true],
    [403, true],
    [429, false],
    [500, false],
  ])("flags an APICallError with status %i as auth failure: %s", (statusCode, expected) => {
    expect(classifyAIProviderError(makeApiError(statusCode))?.isAuthFailure).toBe(expected);
  });

  test("treats a token-endpoint 429 as throttling, not rejected credentials", () => {
    const info = classifyAIProviderError(
      new AIOAuthTokenError("token_request_failed", { statusCode: 429, tokenUrlHost: "idp.example" })
    );

    expect(info).toMatchObject({
      isAuthFailure: false,
      isQuotaExhausted: true,
      isRetryable: true,
      statusCode: 429,
    });
  });

  test("recovers the auth failure from a RetryError", () => {
    const retryError = new RetryError({
      message: "Failed",
      reason: "errorNotRetryable",
      errors: [makeApiError(401)],
    });
    expect(classifyAIProviderError(retryError)?.isAuthFailure).toBe(true);
  });
});
