import { describe, expect, test } from "vitest";
import {
  V3ApiError,
  getV3ApiErrorMessage,
  getV3ApiErrorReason,
  parseV3ApiError,
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

  test("falls back to a provided fallback message", () => {
    expect(getV3ApiErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(getV3ApiErrorMessage("bad", "fallback")).toBe("fallback");
  });
});
