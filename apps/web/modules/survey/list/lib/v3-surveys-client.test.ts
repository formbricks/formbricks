import { describe, expect, test } from "vitest";
import {
  V3ApiError,
  buildSurveyListSearchParams,
  getV3ApiErrorMessage,
  parseV3ApiError,
} from "./v3-surveys-client";

describe("buildSurveyListSearchParams", () => {
  test("emits only supported v3 params using normalized filter values", () => {
    const searchParams = buildSurveyListSearchParams({
      workspaceId: "env_1",
      limit: 20,
      cursor: "cursor_1",
      filters: {
        name: "  Product feedback  ",
        status: ["paused", "draft"],
        type: ["link", "app"],
        sortBy: "relevance",
      },
    });

    expect(searchParams.toString()).toBe(
      "workspaceId=env_1&limit=20&sortBy=relevance&cursor=cursor_1&filter%5Bname%5D%5Bcontains%5D=Product+feedback&filter%5Bstatus%5D%5Bin%5D=draft&filter%5Bstatus%5D%5Bin%5D=paused&filter%5Btype%5D%5Bin%5D=app&filter%5Btype%5D%5Bin%5D=link"
    );
  });
});

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
