import { describe, expect, test } from "vitest";
import {
  V3ApiError,
  getV3ApiErrorMessage,
  getV3ApiErrorReason,
  parseV3ApiError,
  retryUnlessClientError,
  v3RetryDelay,
} from "@/modules/api/lib/v3-client";

describe("parseV3ApiError", () => {
  test("parses RFC 9457 error responses into a typed V3ApiError", async () => {
    const response = new Response(
      JSON.stringify({
        title: "Forbidden",
        status: 403,
        detail: "You are not authorized to access this resource",
        code: "forbidden",
        requestId: "req_1",
        invalid_params: [{ name: "surveyId", reason: "Invalid id" }],
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/problem+json",
          "X-Request-Id": "req_1",
        },
      }
    );

    const error = await parseV3ApiError(response);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error.status).toBe(403);
    expect(error.detail).toBe("You are not authorized to access this resource");
    expect(error.code).toBe("forbidden");
    expect(error.requestId).toBe("req_1");
    expect(error.invalid_params).toEqual([{ name: "surveyId", reason: "Invalid id" }]);
  });

  test("keeps a problem's details, the part a client acts on", async () => {
    const response = new Response(
      JSON.stringify({
        title: "Conflict",
        status: 409,
        detail: "Embedded data key already exists",
        code: "conflict",
        requestId: "req_2",
        details: { reason: "key_conflict", existingId: "clfield1111111111111111111" },
      }),
      { status: 409, headers: { "Content-Type": "application/problem+json" } }
    );

    const error = await parseV3ApiError(response);

    expect(error.details).toEqual({ reason: "key_conflict", existingId: "clfield1111111111111111111" });
  });

  test("reads a refusal's reason code, falling back to its message", () => {
    const refused = new V3ApiError({
      status: 409,
      detail: "DIRECTORY_NAME_DUPLICATE",
      details: { reason: "DIRECTORY_NAME_DUPLICATE" },
    });
    expect(getV3ApiErrorReason(refused, "fallback")).toBe("DIRECTORY_NAME_DUPLICATE");
    expect(getV3ApiErrorReason(new V3ApiError({ status: 403, detail: "Forbidden" }), "fallback")).toBe(
      "Forbidden"
    );
    // Nothing a page can translate: its own message, never a browser's.
    expect(getV3ApiErrorReason(new V3ApiError({ status: 0, detail: "" }), "fallback")).toBe("fallback");
    expect(getV3ApiErrorReason(new Error("Failed to fetch"), "fallback")).toBe("fallback");
  });

  test("shows the fallback for a failure with no detail", () => {
    expect(getV3ApiErrorMessage(new V3ApiError({ status: 0, detail: "" }), "fallback")).toBe("fallback");
  });

  test("reads a 429's Retry-After in seconds, and ignores a form v3 does not send", async () => {
    const tooMany = (retryAfter: string) =>
      parseV3ApiError(
        new Response(JSON.stringify({ status: 429, detail: "Busy", code: "too_many_requests" }), {
          status: 429,
          headers: { "Retry-After": retryAfter },
        })
      );

    expect((await tooMany("1")).retryAfter).toBe(1);
    expect((await tooMany("Wed, 21 Oct 2026 07:28:00 GMT")).retryAfter).toBeUndefined();
    expect((await parseV3ApiError(new Response("{}", { status: 500 }))).retryAfter).toBeUndefined();
  });

  test("falls back to a provided fallback message", () => {
    expect(getV3ApiErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(getV3ApiErrorMessage("bad", "fallback")).toBe("fallback");
  });
});

describe("retryUnlessClientError", () => {
  const problem = (status: number) => new V3ApiError({ status, detail: "x" });

  test("never retries a 4xx: the answer will not change", () => {
    const retry = retryUnlessClientError(3);
    for (const status of [400, 403, 404, 409, 422, 429]) expect(retry(0, problem(status))).toBe(false);
  });

  test("waits out a 429 that asks for a short wait, a few times, but not a spent budget", () => {
    const busy = new V3ApiError({ status: 429, detail: "Busy", retryAfter: 1 });
    const spent = new V3ApiError({ status: 429, detail: "Rate limit exceeded", retryAfter: 42 });
    // A one-retry read still waits for a free slot: the 429 is about timing, not the request.
    const retry = retryUnlessClientError(1);

    expect(retry(0, busy)).toBe(true);
    expect(retry(4, busy)).toBe(true);
    expect(retry(5, busy)).toBe(false);
    expect(retry(0, spent)).toBe(false);
  });

  test("retries a 5xx or a network failure up to the limit", () => {
    const retry = retryUnlessClientError(2);
    expect(retry(0, problem(502))).toBe(true);
    expect(retry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(retry(2, problem(502))).toBe(false);
  });
});

describe("v3RetryDelay", () => {
  test("waits a brief 429's own Retry-After, with jitter under half a second", () => {
    const delay = v3RetryDelay(0, new V3ApiError({ status: 429, detail: "Busy", retryAfter: 2 }));
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThan(2500);
  });

  test("backs off exponentially for anything else, capped at 30 seconds", () => {
    expect(v3RetryDelay(0, new TypeError("Failed to fetch"))).toBe(1000);
    expect(v3RetryDelay(2, new V3ApiError({ status: 502, detail: "x" }))).toBe(4000);
    expect(v3RetryDelay(10, new V3ApiError({ status: 502, detail: "x" }))).toBe(30_000);
  });
});
