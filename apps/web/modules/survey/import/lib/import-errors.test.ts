import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getSurveyImportErrorMessage, getSurveyImportRequestErrorCode } from "./import-errors";

const refusal = (status: number, code?: string, invalidParamNames: string[] = []) =>
  new V3ApiError({
    status,
    detail: "refused",
    code,
    invalid_params: invalidParamNames.map((name) => ({ name, reason: "bad" })),
  });

/** A refusal of the uploaded file, coded the way the import route codes it. */
const fileRefusal = (status: number, paramCode: string, identifier?: string) =>
  new V3ApiError({
    status,
    detail: "refused",
    code: status === 415 ? "unsupported_media_type" : "unprocessable_content",
    invalid_params: [{ name: "file", reason: "bad", code: paramCode, ...(identifier ? { identifier } : {}) }],
  });

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;

describe("getSurveyImportRequestErrorCode", () => {
  test.each([
    [
      "an array past the JSON budget",
      fileRefusal(422, "file_limit_exceeded", "array_items"),
      "file_too_complex",
    ],
    ["nesting past the cap", fileRefusal(422, "file_limit_exceeded", "nesting_depth"), "file_too_complex"],
    ["a broken file", fileRefusal(422, "file_unreadable"), "file_unreadable"],
    ["a body the dialog sent wrong", refusal(400, "bad_request", ["fileName"]), "file_unreadable"],
    ["a body that is not multipart", refusal(415, "unsupported_media_type"), "qsf_not_recognized"],
    [
      "a file that is no Qualtrics export",
      fileRefusal(415, "file_type_unsupported", "csv"),
      "qsf_not_recognized",
    ],
    ["a .doc or .xls", fileRefusal(415, "file_type_unsupported", "legacy_office"), "qsf_not_recognized"],
    ["a missing session", refusal(401, "not_authenticated"), "not_authenticated"],
    ["a body over the route's limit", refusal(413, "payload_too_large"), "file_too_large"],
    ["an archive past a zip limit", fileRefusal(413, "file_limit_exceeded", "zip_entries"), "file_too_large"],
    [
      "valid JSON that is not a QSF",
      refusal(422, "unprocessable_content", ["file.SurveyEntry"]),
      "qsf_not_recognized",
    ],
    ["the AI gate", refusal(403, "ai_smart_tools_disabled"), "ai_smart_tools_disabled"],
    ["an import already running", refusal(429, "concurrency_limit_reached"), "concurrency_limit_reached"],
    ["a full pod", refusal(503, "capacity_reached"), "capacity_reached"],
    ["a refusal without a code", refusal(500), "ai_unknown"],
  ])("maps %s", (_case, error, code) => {
    expect(getSurveyImportRequestErrorCode(error)).toBe(code);
  });
  test("names the limit a Qualtrics export is past", () => {
    const error = new V3ApiError({
      status: 422,
      detail: "refused",
      code: "unprocessable_content",
      invalid_params: [
        {
          name: "file.SurveyElements",
          reason: "too many",
          code: "qsf_limit_exceeded",
          identifier: "questions",
        },
      ],
    });

    expect(getSurveyImportRequestErrorCode(error)).toBe("qsf_limit_exceeded:questions");
  });
});

describe("getSurveyImportErrorMessage for a file past a limit", () => {
  test.each([
    "questions",
    "options",
    "languages",
    "language_keys",
    "blocks",
    "block_entries",
    "flow_nodes",
    "flow_depth",
    "embedded_data",
    "texts",
    "formatted_texts",
    "prompt_size",
  ])("says which limit for %s", (limit) => {
    expect(getSurveyImportErrorMessage(`qsf_limit_exceeded:${limit}`, t)).toBe(
      `workspace.surveys.import.errors.limits.${limit}`
    );
  });

  test("falls back to a general line for a limit this client does not know yet", () => {
    expect(getSurveyImportErrorMessage("qsf_limit_exceeded:something_new", t)).toBe(
      "workspace.surveys.import.errors.limits.other"
    );
  });
});

describe("getSurveyImportErrorMessage for each refusal and stream error", () => {
  test.each([
    ["file_wrong_extension", "wrong_extension"],
    ["file_empty", "empty_file"],
    ["file_too_large", "file_too_large"],
    ["qsf_not_recognized", "not_a_qsf"],
    ["file_too_complex", "too_complex"],
    ["file_unreadable", "unreadable"],
    ["not_authenticated", "session_expired"],
    ["forbidden", "not_allowed"],
    ["concurrency_limit_reached", "already_importing"],
    ["capacity_reached", "busy"],
    ["import_timed_out", "timed_out"],
    ["import_failed", "failed"],
  ])("%s", (code, key) => {
    expect(getSurveyImportErrorMessage(code, t)).toBe(`workspace.surveys.import.errors.${key}`);
  });
});

describe("getSurveyImportErrorMessage", () => {
  test("says when to retry a rate-limited import", () => {
    expect(getSurveyImportErrorMessage("too_many_requests", t, 42)).toBe(
      'workspace.surveys.import.errors.rate_limited {"seconds":42}'
    );
  });

  test("falls back to Create with AI's wording without a Retry-After", () => {
    expect(getSurveyImportErrorMessage("too_many_requests", t)).toBe(
      "workspace.surveys.ai_create.too_many_requests"
    );
  });

  test("says when to retry once the AI provider's quota frees up", () => {
    expect(getSurveyImportErrorMessage("ai_quota_exceeded", t, 30)).toBe(
      'workspace.surveys.import.errors.ai_busy {"seconds":30}'
    );
  });

  test.each([
    ["ai_output_too_long", "workspace.surveys.import.errors.too_complex"],
    ["bad_request", "workspace.surveys.import.errors.failed"],
  ])("words %s for a file, not a prompt", (code, message) => {
    expect(getSurveyImportErrorMessage(code, t)).toBe(message);
  });

  test("tells an import already running apart from the rate limit", () => {
    expect(getSurveyImportErrorMessage("concurrency_limit_reached", t, 15)).toBe(
      "workspace.surveys.import.errors.already_importing"
    );
  });

  test.each([
    ["qsf_not_recognized", "workspace.surveys.import.errors.not_a_qsf"],
    ["import_timed_out", "workspace.surveys.import.errors.timed_out"],
    ["ai_quota_exceeded", "workspace.surveys.ai_create.ai_rate_limited"],
    ["something_new", "common.something_went_wrong_please_try_again"],
  ])("words %s", (code, message) => {
    expect(getSurveyImportErrorMessage(code, t)).toBe(message);
  });
});
