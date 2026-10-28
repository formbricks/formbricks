import { describe, expect, test } from "vitest";
import { problemDestructiveChange, problemStaleDocument } from "@/app/api/v3/documents/lib/envelope";
import {
  problemBadRequest,
  problemForbidden,
  problemNotFound,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { classifyDryRun, readPushResult } from "./classify";

const envelope = {
  kind: "survey",
  schemaVersion: 1,
  id: "s1",
  workspaceId: "ws1",
  updatedAt: "2026-10-28T12:00:00.000Z",
  document: { name: "S" },
};

describe("classifyDryRun", () => {
  test("a successful dry run is an ok outcome carrying the result", async () => {
    const result = { envelope, dryRun: true, changes: [{ path: "name", change: "changed" }] };
    expect(await classifyDryRun(successResponse(result))).toEqual({
      kind: "outcome",
      outcome: { type: "ok", result },
    });
  });

  test("a success whose body is not a push result is an error, not a review of nothing", async () => {
    expect(await classifyDryRun(successResponse({ unexpected: true }))).toEqual({ kind: "error" });
  });

  test("a stale 409 is a stale outcome with the server's wording", async () => {
    const response = problemStaleDocument("req", "2026-10-28T12:00:00.000Z", "2026-10-28T13:00:00.000Z");
    expect(await classifyDryRun(response)).toEqual({
      kind: "outcome",
      outcome: { type: "stale", detail: expect.stringContaining("changed since this document was pulled") },
    });
  });

  test("a destructive 409 carries the changes it named", async () => {
    const changes = [{ type: "blocks_removed", ids: ["b1"], responseCount: 4 }];
    expect(await classifyDryRun(problemDestructiveChange("req", changes))).toEqual({
      kind: "outcome",
      outcome: { type: "destructive", changes },
    });
  });

  test("a 422 is an invalid outcome with its problems", async () => {
    const response = problemUnprocessableContent("req", "Survey document failed validation", {
      invalid_params: [{ name: "blocks.0", reason: "Required" }],
    });
    expect(await classifyDryRun(response)).toEqual({
      kind: "outcome",
      outcome: {
        type: "invalid",
        detail: "Survey document failed validation",
        issues: [{ name: "blocks.0", reason: "Required" }],
      },
    });
  });

  test("any other refusal is the tool's own error", async () => {
    expect(await classifyDryRun(problemForbidden("req", "no"))).toEqual({ kind: "error" });
    expect(await classifyDryRun(problemNotFound("req", "Survey", "s1"))).toEqual({ kind: "error" });
    expect(await classifyDryRun(problemBadRequest("req", "bad"))).toEqual({ kind: "error" });
  });

  test("leaves the response readable for the caller that has to pass an error on", async () => {
    const response = problemForbidden("req", "no");
    await classifyDryRun(response);
    expect(response.bodyUsed).toBe(false);
  });
});

describe("readPushResult", () => {
  test("is undefined for a failure", async () => {
    expect(await readPushResult(problemForbidden("req", "no"))).toBeUndefined();
  });
});
