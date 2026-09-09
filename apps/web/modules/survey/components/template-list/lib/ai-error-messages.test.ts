import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAiErrorCode, getAiErrorMessage } from "./ai-error-messages";

// Identity stand-in for `t`, so the assertions read as the keys the copy resolves to.
const t = (key: string) => key;

describe("getAiErrorMessage", () => {
  test.each([
    // The three "AI is unavailable" codes read the shared copy, not a survey-specific sentence.
    ["ai_features_not_enabled", "common.ai_unavailable.not_in_plan"],
    ["ai_smart_tools_disabled", "common.ai_unavailable.not_enabled"],
    ["ai_instance_not_configured", "common.ai_unavailable.instance_not_configured"],
    ["ai_generated_payload_invalid", "workspace.surveys.ai_create.generated_payload_invalid"],
    ["ai_output_too_long", "workspace.surveys.ai_create.ai_output_too_long"],
    ["ai_quota_exceeded", "workspace.surveys.ai_create.ai_rate_limited"],
    ["ai_generation_failed", "workspace.surveys.ai_create.generation_failed"],
    ["ai_nothing_generated", "workspace.surveys.ai_create.nothing_generated"],
  ])("gives %s its own message", (code, key) => {
    expect(getAiErrorMessage(code, t)).toBe(key);
  });

  test("falls back for an unknown or missing code", () => {
    // Both the pre-stream problem+json path and the in-band event path land here for a code the
    // client has not been taught yet, so neither can surface a blank error.
    expect(getAiErrorMessage("something_new", t)).toBe("common.something_went_wrong_please_try_again");
    expect(getAiErrorMessage(undefined, t)).toBe("common.something_went_wrong_please_try_again");
  });
});

describe("failures raised by the API wrapper rather than by generation", () => {
  test('the rate limit tells the user to wait instead of "something went wrong"', () => {
    // The wrapper answers the 10/min bucket with its own code, not an ai_* one.
    const error = new V3ApiError({ status: 429, detail: "Rate limit exceeded", code: "too_many_requests" });

    expect(getAiErrorMessage(getAiErrorCode(error), t)).toBe("workspace.surveys.ai_create.too_many_requests");
  });

  test("a rejected request points at the prompt", () => {
    const error = new V3ApiError({ status: 400, detail: "Invalid body", code: "bad_request" });

    expect(getAiErrorMessage(getAiErrorCode(error), t)).toBe("workspace.surveys.ai_create.request_rejected");
  });
});

describe("getAiErrorCode", () => {
  test("reads the code off a V3ApiError", () => {
    const error = new V3ApiError({ status: 503, detail: "AI unavailable", code: "ai_smart_tools_disabled" });

    expect(getAiErrorCode(error)).toBe("ai_smart_tools_disabled");
  });

  test("returns a code that still renders a message for an unrecognised failure", () => {
    // Never null: a dropped connection has to surface something rather than clear the error.
    expect(getAiErrorMessage(getAiErrorCode(new Error("network")), t)).toBe(
      "common.something_went_wrong_please_try_again"
    );
  });
});
