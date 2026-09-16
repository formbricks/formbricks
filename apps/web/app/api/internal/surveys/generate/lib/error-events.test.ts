import { describe, expect, test } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { V3SurveyGeneratedPayloadValidationError } from "@/app/api/v3/surveys/generate/service";
import { isClientAbort, toStreamErrorEvent } from "./error-events";

describe("toStreamErrorEvent", () => {
  test("maps a quota error to ai_quota_exceeded and forwards retryAfter", () => {
    const event = toStreamErrorEvent(new TooManyRequestsError("ai_quota_exceeded", 42));

    expect(event.code).toBe("ai_quota_exceeded");
    expect(event.retryAfter).toBe(42);
  });

  test("maps the output token limit to ai_output_too_long", () => {
    expect(toStreamErrorEvent(new AIOutputTokenLimitError({ maxOutputTokens: 8192 })).code).toBe(
      "ai_output_too_long"
    );
  });

  test("maps a payload validation failure to ai_generated_payload_invalid with its params", () => {
    const invalidParams = [{ name: "generatedSurvey.name", reason: "Required" }];

    const event = toStreamErrorEvent(new V3SurveyGeneratedPayloadValidationError(invalidParams));

    expect(event.code).toBe("ai_generated_payload_invalid");
    expect(event.invalid_params).toEqual(invalidParams);
  });

  test("falls back to ai_generation_failed for anything else", () => {
    expect(toStreamErrorEvent(new Error("socket hang up")).code).toBe("ai_generation_failed");
  });

  test("never leaks the caught error's message into detail", () => {
    // The detail is rendered to the user, and provider errors routinely echo prompt fragments back.
    const leaky = new Error("prompt rejected: 'ask employees about their salary at ACME Corp'");

    const event = toStreamErrorEvent(leaky);

    expect(event.detail).not.toContain("ACME Corp");
    expect(event.detail).not.toContain(leaky.message);
    expect(event.detail.length).toBeGreaterThan(0);
  });
});

describe("isClientAbort", () => {
  const abortedSignal = () => {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  };

  test("treats any failure on an aborted request as a client abort", () => {
    expect(isClientAbort(new Error("stream closed"), abortedSignal())).toBe(true);
  });

  test("recognises an AbortError even when the signal has not settled", () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";

    expect(isClientAbort(error, new AbortController().signal)).toBe(true);
  });

  test("does not swallow a real generation failure", () => {
    expect(
      isClientAbort(new TooManyRequestsError("ai_quota_exceeded", 30), new AbortController().signal)
    ).toBe(false);
  });
});
