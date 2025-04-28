import { responses } from "@/app/lib/api/response";
import { MAX_OTHER_OPTION_LENGTH } from "@/lib/constants";
import { describe, expect, test, vi } from "vitest";
import { TSurveyQuestionChoice } from "@formbricks/types/surveys/types";
import { validateOtherOptionLength } from "./utils";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn().mockImplementation((value, language) => {
    return typeof value === "string" ? value : value[language] || value["default"] || "";
  }),
}));

describe("validateOtherOptionLength", () => {
  const mockChoices: TSurveyQuestionChoice[] = [
    { id: "1", label: { default: "Option 1", fr: "Option one" } },
    { id: "2", label: { default: "Option 2", fr: "Option two" } },
    { id: "3", label: { default: "Option 3", fr: "Option Trois" } },
  ];

  test("returns undefined when value matches a choice", () => {
    const result = validateOtherOptionLength("Option 1", mockChoices, "q1");
    expect(result).toBeUndefined();
  });

  test("returns undefined when other option is within length limit", () => {
    const shortValue = "A".repeat(MAX_OTHER_OPTION_LENGTH);
    const result = validateOtherOptionLength(shortValue, mockChoices, "q1");
    expect(result).toBeUndefined();
  });

  test("returns bad request response when other option exceeds length limit", () => {
    const mockResponse = new Response(JSON.stringify({ message: "Test" }), { status: 400 });
    vi.spyOn(responses, "badRequestResponse").mockReturnValue(mockResponse);

    const longValue = "A".repeat(MAX_OTHER_OPTION_LENGTH + 1);
    const result = validateOtherOptionLength(longValue, mockChoices, "q1");

    expect(result).toBe(mockResponse);
    expect(responses.badRequestResponse).toHaveBeenCalledWith(
      "Other option text is too long",
      { questionId: "q1" },
      true
    );
  });

  test("handles localized choice labels", () => {
    const result = validateOtherOptionLength("Option Trois", mockChoices, "q1", "fr");
    expect(result).toBeUndefined();
  });

  test("uses default language when no language is provided", () => {
    const result = validateOtherOptionLength("Option 3", mockChoices, "q1");
    expect(result).toBeUndefined();
  });
});
