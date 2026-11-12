import { describe, expect, test } from "vitest";
import { problemConflict, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { hideOutsideMcpGrant, responseToMcpToolResult } from "./errors";

describe("responseToMcpToolResult", () => {
  test("returns structured success content with the resolved requestId", async () => {
    const result = await responseToMcpToolResult(successResponse({ id: "s1" }, { requestId: "req_1" }), "fb");

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ data: { id: "s1" }, requestId: "req_1" });
  });

  test("forwards problem details so a 409 tells the agent what to retry with", async () => {
    // ENG-3069: without this the agent sees "Conflict" and has to re-read the whole survey to
    // discover the timestamp the error already carried.
    const response = problemConflict("req_2", "Survey was modified since it was last read", "/api/mcp", {
      details: {
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
        currentUpdatedAt: "2026-01-02T00:00:00.000Z",
      },
    });

    const result = await responseToMcpToolResult(response, "fb");

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: {
        status: 409,
        code: "conflict",
        requestId: "req_2",
        details: {
          expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
          currentUpdatedAt: "2026-01-02T00:00:00.000Z",
        },
      },
    });
  });

  test("omits details when the problem has none, and still forwards invalid_params", async () => {
    const response = problemUnprocessableContent("req_3", "nope", {
      invalid_params: [{ name: "ops.0.id", reason: "unknown block", code: "dangling_reference" }],
    });

    const result = await responseToMcpToolResult(response, "fb");
    const payload = result.structuredContent as { error: Record<string, unknown> };

    expect(payload.error).not.toHaveProperty("details");
    expect(payload.error.invalid_params).toEqual([
      { name: "ops.0.id", reason: "unknown block", code: "dangling_reference" },
    ]);
  });

  test("falls back to the supplied requestId when the body carries none", async () => {
    const result = await responseToMcpToolResult(new Response("not json", { status: 500 }), "fallback_id");

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { requestId: "fallback_id", status: 500 } });
  });
});

describe("hideOutsideMcpGrant", () => {
  const refusal = (status: number, code: string, detail: string) =>
    responseToMcpToolResult(
      new Response(JSON.stringify({ status, title: "x", detail, code, requestId: "req_1" }), { status }),
      "req_1"
    );
  const NOT_FOUND = {
    status: 404,
    title: "Not Found",
    code: "not_found",
    detail: "Not found. It doesn't exist, or the user's grant to this MCP client doesn't reach it.",
    requestId: "req_1",
  };

  test.each([
    ["a refusal by the user's role or an unknown id", 403, "forbidden", "You are not authorized"],
    ["an operation's own not found", 404, "not_found", "Chart not found"],
  ])("answers %s with one not found", async (_case, status, code, detail) => {
    const hidden = hideOutsideMcpGrant(await refusal(status, code, detail), "req_1");
    expect(hidden.isError).toBe(true);
    expect(hidden.structuredContent).toEqual({ error: NOT_FOUND });
    expect(JSON.parse((hidden.content?.[0] as { text: string }).text)).toEqual({ error: NOT_FOUND });
  });

  test.each([
    ["a success", 200, undefined, undefined],
    [
      "a refusal for a plan the organization lacks",
      403,
      "dashboards_plan_required",
      "Dashboards are not enabled",
    ],
    ["a validation error", 422, "unprocessable_content", "Bad input"],
    ["a rate limit", 429, "too_many_requests", "Slow down"],
  ])("leaves %s as it is", async (_case, status, code, detail) => {
    const result =
      status === 200
        ? await responseToMcpToolResult(new Response(JSON.stringify({ data: [] }), { status }), "req_1")
        : await refusal(status, code as string, detail as string);
    expect(hideOutsideMcpGrant(result, "req_1")).toEqual(result);
  });
});
