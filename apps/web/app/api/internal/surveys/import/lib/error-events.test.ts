import { describe, expect, test } from "vitest";
import { SurveyImportFailedError } from "@/modules/survey/import/core/errors";
import { toSurveyImportStreamErrorEvent } from "./error-events";

describe("toSurveyImportStreamErrorEvent", () => {
  test.each([
    ["too_many_questions", "import_too_large"],
    // Lines the AI never read: not "too many questions" and MCP, but try again.
    ["partly_unread", "import_partly_unread"],
    ["nothing_importable", "import_nothing_importable"],
    // A plan that failed on the way may succeed on another try, or through MCP.
    ["no_questions", "import_no_questions"],
    ["too_large_for_ai", "import_too_large_for_ai"],
    ["draft_invalid", "import_failed"],
    ["prompt_budget", "import_failed"],
  ] as const)("a %s failure is %s", (reason, code) => {
    expect(toSurveyImportStreamErrorEvent(new SurveyImportFailedError(reason))).toMatchObject({
      type: "error",
      code,
    });
  });

  test("never quotes the caught error, which can echo the file", () => {
    const event = toSurveyImportStreamErrorEvent(new Error("Q1: What is your salary?"));
    expect(event).toMatchObject({ type: "error", code: "import_failed" });
    expect(event.detail).not.toContain("salary");
  });
});
