import { describe, expect, test } from "vitest";
import { problemConflict, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { responseToMcpToolResult } from "./errors";

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
