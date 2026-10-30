import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAITranslationErrorMessage } from "./error-message";

const t = (key: string) => key;
const apiError = (status: number, code?: string) => new V3ApiError({ status, detail: "detail", code });

describe("getAITranslationErrorMessage", () => {
  test.each([
    ["ai_features_not_enabled", 403, "common.ai_unavailable.not_in_plan"],
    ["ai_smart_tools_disabled", 403, "common.ai_unavailable.not_enabled"],
    ["ai_instance_not_configured", 503, "common.ai_unavailable.instance_not_configured"],
  ])("reads %s as the shared AI-unavailable message", (code, status, message) => {
    expect(getAITranslationErrorMessage(apiError(status, code), t)).toBe(message);
  });

  test.each([
    ["the provider's quota", "too_many_requests"],
    ["the route's request budget", undefined],
  ])("reads a 429 from %s as try-again-shortly", (_label, code) => {
    expect(getAITranslationErrorMessage(apiError(429, code), t)).toBe(
      "workspace.surveys.edit.ai_translation_quota_exceeded"
    );
  });

  test("reads a batch too large for one answer as translate-in-parts", () => {
    expect(getAITranslationErrorMessage(apiError(422, "ai_output_too_long"), t)).toBe(
      "workspace.surveys.edit.ai_translation_output_too_long"
    );
  });

  test.each([
    ["a provider failure", apiError(502, "bad_gateway")],
    ["a network failure", new V3ApiError({ status: 0, detail: "", code: "network_error" })],
    ["a non-API error", new Error("boom")],
  ])("reads %s as the generic failure, never a raw code", (_label, error) => {
    expect(getAITranslationErrorMessage(error, t)).toBe("workspace.surveys.edit.ai_translation_failed");
  });
});
