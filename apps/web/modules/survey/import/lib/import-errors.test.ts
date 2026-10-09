import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getQsfImportErrorMessage, getQsfImportRequestErrorCode } from "./import-errors";

const refusal = (status: number, code?: string, invalidParamNames: string[] = []) =>
  new V3ApiError({
    status,
    detail: "refused",
    code,
    invalid_params: invalidParamNames.map((name) => ({ name, reason: "bad" })),
  });

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

describe("getQsfImportRequestErrorCode", () => {
  test.each([
    [
      "an array past the budget",
      refusal(400, "bad_request", ["qsf.SurveyElements.0.Payload.ChoiceOrder"]),
      "qsf_too_complex",
    ],
    ["nesting past the cap", refusal(400, "bad_request", ["qsf.SurveyElements.3"]), "qsf_too_complex"],
    ["a body the dialog sent wrong", refusal(400, "bad_request", ["fileName"]), "qsf_unreadable"],
    ["a missing session", refusal(401, "not_authenticated"), "not_authenticated"],
    ["a body over the route's limit", refusal(413, "payload_too_large"), "qsf_too_large"],
    [
      "valid JSON that is not a QSF",
      refusal(422, "unprocessable_content", ["qsf.SurveyEntry"]),
      "qsf_not_recognized",
    ],
    ["the AI gate", refusal(403, "ai_smart_tools_disabled"), "ai_smart_tools_disabled"],
    ["an import already running", refusal(429, "concurrency_limit_reached"), "concurrency_limit_reached"],
    ["a full pod", refusal(503, "capacity_reached"), "capacity_reached"],
    ["a refusal without a code", refusal(500), "ai_unknown"],
  ])("maps %s", (_case, error, code) => {
    expect(getQsfImportRequestErrorCode(error)).toBe(code);
  });
  test("names the limit a Qualtrics export is past", () => {
    const error = new V3ApiError({
      status: 422,
      detail: "refused",
      code: "unprocessable_content",
      invalid_params: [
        {
          name: "qsf.SurveyElements",
          reason: "too many",
          code: "qsf_limit_exceeded",
          identifier: "questions",
        },
      ],
    });

    expect(getQsfImportRequestErrorCode(error)).toBe("qsf_limit_exceeded:questions");
  });
});

describe("getQsfImportErrorMessage for a file past a limit", () => {
  test.each([
    ["qsf_limit_exceeded:questions", "workspace.surveys.import.errors.limits.questions"],
    ["qsf_limit_exceeded:prompt_size", "workspace.surveys.import.errors.limits.prompt_size"],
    ["qsf_limit_exceeded:something_new", "workspace.surveys.import.errors.limits.other"],
  ])("says which limit for %s", (code, message) => {
    expect(getQsfImportErrorMessage(code, t)).toBe(message);
  });
});

describe("getQsfImportErrorMessage", () => {
  test("says when to retry a rate-limited import", () => {
    expect(getQsfImportErrorMessage("too_many_requests", t, 42)).toBe(
      'workspace.surveys.import.errors.rate_limited {"seconds":42}'
    );
  });

  test("falls back to Create with AI's wording without a Retry-After", () => {
    expect(getQsfImportErrorMessage("too_many_requests", t)).toBe(
      "workspace.surveys.ai_create.too_many_requests"
    );
  });

  test("tells an import already running apart from the rate limit", () => {
    expect(getQsfImportErrorMessage("concurrency_limit_reached", t, 15)).toBe(
      "workspace.surveys.import.errors.already_importing"
    );
  });

  test.each([
    ["qsf_not_json", "workspace.surveys.import.errors.not_a_qsf"],
    ["qsf_not_object", "workspace.surveys.import.errors.not_a_qsf"],
    ["qsf_not_recognized", "workspace.surveys.import.errors.not_a_qsf"],
    ["import_timed_out", "workspace.surveys.import.errors.timed_out"],
    ["ai_quota_exceeded", "workspace.surveys.ai_create.ai_rate_limited"],
    ["something_new", "common.something_went_wrong_please_try_again"],
  ])("words %s", (code, message) => {
    expect(getQsfImportErrorMessage(code, t)).toBe(message);
  });
});
