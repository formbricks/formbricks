import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  buildTestRunInput,
  classifyTestRunError,
  getTestRunBlocker,
  getTestRunDrawerPayload,
} from "./test-run";

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
  test("a Webhook and a Response completed trigger can be tested, no trigger cannot", () => {
    expect(getTestRunBlocker({ triggerType: "webhook", status: "draft" })).toBeNull();
    expect(getTestRunBlocker({ triggerType: "response.completed", status: "enabled" })).toBeNull();
    expect(getTestRunBlocker({ triggerType: null, status: "draft" })).toBe("no_trigger");
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

  test("a picked response refused means it is gone or no longer the trigger survey's", () => {
    expect(
      classifyTestRunError(problem(403, "forbidden"), { sentPayload: false, sentResponseId: true })
    ).toBe("response_unavailable");
    expect(classifyTestRunError(problem(403, "forbidden"), { sentPayload: false })).toBe("other");
  });

  test("a refused state for a response run is not a missing payload", () => {
    expect(
      classifyTestRunError(problem(422, "invalid_workflow_state"), {
        sentPayload: false,
        sentResponseId: true,
      })
    ).toBe("other");
  });

  test("anything else is unexplained", () => {
    expect(classifyTestRunError(problem(422, "invalid_workflow_state"), { sentPayload: true })).toBe("other");
    expect(classifyTestRunError(problem(500, "internal_server_error"), { sentPayload: false })).toBe("other");
    expect(classifyTestRunError(new TypeError("Failed to fetch"), { sentPayload: false })).toBe("other");
  });
});

describe("getTestRunDrawerPayload", () => {
  const sample = { channel: "call" };

  test("shows the payload kept in this browser, the same text the Webhook trigger panel shows", () => {
    expect(getTestRunDrawerPayload({ stored: '{ "channel": "chat" }', sample })).toEqual({
      text: '{ "channel": "chat" }',
      source: "edited",
      canRunAgain: true,
      canReset: true,
    });
  });

  test("shows the last received payload while nothing is kept, with nothing to reset", () => {
    expect(getTestRunDrawerPayload({ stored: null, sample })).toEqual({
      text: '{\n  "channel": "call"\n}',
      source: "received",
      canRunAgain: true,
      canReset: false,
    });
  });

  test("blocks Run again while the kept payload is not a JSON object", () => {
    expect(getTestRunDrawerPayload({ stored: '{ "channel": ', sample }).canRunAgain).toBe(false);
    expect(getTestRunDrawerPayload({ stored: "[1, 2]", sample }).canRunAgain).toBe(false);
  });

  test("runs a blank kept payload with the Sample payload, as the header's Test run does", () => {
    expect(getTestRunDrawerPayload({ stored: "  ", sample }).canRunAgain).toBe(true);
  });

  test("cannot reset to a received payload when none was ever received", () => {
    expect(getTestRunDrawerPayload({ stored: '{ "a": 1 }', sample: null }).canReset).toBe(false);
  });
});
