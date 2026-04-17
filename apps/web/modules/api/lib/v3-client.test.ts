import { describe, expect, test } from "vitest";
import { V3ApiError, getV3ApiErrorMessage, parseV3ApiError } from "@/modules/api/lib/v3-client";

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

  test("falls back to a provided fallback message", () => {
    expect(getV3ApiErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(getV3ApiErrorMessage("bad", "fallback")).toBe("fallback");
  });
});
