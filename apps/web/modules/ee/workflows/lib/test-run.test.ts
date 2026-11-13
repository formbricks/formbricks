import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  buildTestRunInput,
  classifyTestRunError,
  getTestPayloadStorageKey,
  getTestRunBlocker,
  readStoredTestPayload,
  withTestRunsHidden,
} from "./test-run";

const storageWith = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
});

describe("readStoredTestPayload", () => {
  test("reads the payload the trigger panel keeps for this workflow", () => {
    const storage = storageWith({ [getTestPayloadStorageKey("wf_1")]: '{"a":1}' });
    expect(readStoredTestPayload("wf_1", storage)).toBe('{"a":1}');
    expect(readStoredTestPayload("wf_2", storage)).toBeNull();
  });

  test("is null when the browser refuses storage", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readStoredTestPayload("wf_1", throwing)).toBeNull();
    expect(readStoredTestPayload("wf_1", null)).toBeNull();
  });
});

describe("buildTestRunInput", () => {
  test("sends the payload kept in this browser", () => {
    expect(buildTestRunInput('{ "channel": "call" }')).toEqual({
      ok: true,
      input: { payload: { channel: "call" } },
    });
  });

  test("sends no payload when none is kept, so the server uses the Sample payload", () => {
    expect(buildTestRunInput(null)).toEqual({ ok: true, input: {} });
    expect(buildTestRunInput("   ")).toEqual({ ok: true, input: {} });
  });

  test("refuses a kept payload that is not a JSON object", () => {
    expect(buildTestRunInput("{ nope")).toEqual({ ok: false, reason: "invalid_payload" });
    expect(buildTestRunInput("[1, 2]")).toEqual({ ok: false, reason: "invalid_payload" });
  });
});

describe("getTestRunBlocker", () => {
  test("only a Webhook trigger can be tested", () => {
    expect(getTestRunBlocker({ triggerType: "webhook", status: "draft" })).toBeNull();
    expect(getTestRunBlocker({ triggerType: "response.completed", status: "draft" })).toBe("not_webhook");
    expect(getTestRunBlocker({ triggerType: null, status: "draft" })).toBe("not_webhook");
  });

  test("an archived workflow cannot be tested", () => {
    expect(getTestRunBlocker({ triggerType: "webhook", status: "archived" })).toBe("archived");
  });
});

describe("classifyTestRunError", () => {
  const problem = (status: number, code: string) => new V3ApiError({ status, code, detail: "x" });

  test("a refused state without a sent payload means there was nothing to test with", () => {
    expect(classifyTestRunError(problem(422, "invalid_workflow_state"), { sentPayload: false })).toBe(
      "no_payload"
    );
  });

  test("names a draft that cannot run, a payload that is too large, and a payload refused", () => {
    expect(classifyTestRunError(problem(422, "workflow_not_executable"), { sentPayload: false })).toBe(
      "not_executable"
    );
    expect(classifyTestRunError(problem(413, "payload_too_large"), { sentPayload: true })).toBe(
      "payload_too_large"
    );
    expect(classifyTestRunError(problem(400, "bad_request"), { sentPayload: true })).toBe("invalid_payload");
  });

  test("anything else is unexplained", () => {
    expect(classifyTestRunError(problem(422, "invalid_workflow_state"), { sentPayload: true })).toBe("other");
    expect(classifyTestRunError(problem(500, "internal_server_error"), { sentPayload: false })).toBe("other");
    expect(classifyTestRunError(new TypeError("Failed to fetch"), { sentPayload: false })).toBe("other");
  });
});

describe("withTestRunsHidden", () => {
  test("hiding Test runs asks the list for real runs only, keeping the other filters", () => {
    expect(withTestRunsHidden({ workflowId: "wf_1" }, true)).toEqual({ workflowId: "wf_1", isDryRun: false });
  });

  test("showing them drops the filter", () => {
    expect(withTestRunsHidden({ workflowId: "wf_1", isDryRun: false }, false)).toEqual({
      workflowId: "wf_1",
    });
    expect(withTestRunsHidden(undefined, false)).toEqual({});
  });
});
