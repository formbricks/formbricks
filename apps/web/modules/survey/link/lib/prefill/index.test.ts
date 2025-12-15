import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { getPrefillValue } from "./index";

describe("prefill integration tests", () => {
  const mockSurvey = {
    id: "survey1",
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    blocks: [
      {
        id: "block1",
        elements: [
          {
            id: "q1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Open Text Question" },
            required: true,
            inputType: "text",
            charLimit: { enabled: false },
          },
          {
            id: "q2",
            type: TSurveyElementTypeEnum.MultipleChoiceSingle,
            headline: { default: "Multiple Choice Question" },
            required: false,
            choices: [
              { id: "c1", label: { default: "Option 1" } },
              { id: "c2", label: { default: "Option 2" } },
            ],
            shuffleOption: "none",
          },
          {
            id: "q3",
            type: TSurveyElementTypeEnum.MultipleChoiceSingle,
            headline: { default: "Multiple Choice with Other" },
            required: false,
            choices: [
              { id: "c3", label: { default: "Option 3" } },
              { id: "other", label: { default: "Other" } },
            ],
            shuffleOption: "none",
          },
          {
            id: "q4",
            type: TSurveyElementTypeEnum.MultipleChoiceMulti,
            headline: { default: "Multiple Choice Multi" },
            required: false,
            choices: [
              { id: "c4", label: { default: "Option 4" } },
              { id: "c5", label: { default: "Option 5" } },
            ],
            shuffleOption: "none",
          },
          {
            id: "q5",
            type: TSurveyElementTypeEnum.MultipleChoiceMulti,
            headline: { default: "Multiple Choice Multi with Other" },
            required: false,
            choices: [
              { id: "c6", label: { default: "Option 6" } },
              { id: "other", label: { default: "Other" } },
            ],
            shuffleOption: "none",
          },
          {
            id: "q6",
            type: TSurveyElementTypeEnum.NPS,
            headline: { default: "NPS Question" },
            required: false,
            lowerLabel: { default: "Not likely" },
            upperLabel: { default: "Very likely" },
          },

          {
            id: "q8",
            type: TSurveyElementTypeEnum.Consent,
            headline: { default: "Consent Question" },
            required: true,
            label: { default: "I agree" },
          },
          {
            id: "q9",
            type: TSurveyElementTypeEnum.Rating,
            headline: { default: "Rating Question" },
            required: false,
            range: 5,
            scale: "number",
            lowerLabel: { default: "Not good" },
            upperLabel: { default: "Very good" },
          },
          {
            id: "q10",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Picture Selection" },
            required: false,
            choices: [
              { id: "p1", imageUrl: "image1.jpg" },
              { id: "p2", imageUrl: "image2.jpg" },
            ],
            allowMulti: false,
          },
          {
            id: "q11",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Multi Picture Selection" },
            required: false,
            choices: [
              { id: "p3", imageUrl: "image3.jpg" },
              { id: "p4", imageUrl: "image4.jpg" },
            ],
            allowMulti: true,
          },
        ],
      },
    ],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome" },
      subheader: { default: "" },
      buttonLabel: { default: "Start" },
    },
    hiddenFields: {},
    languages: {
      default: "default",
    },
    status: "draft",
  } as unknown as TSurvey;

  test("returns undefined when no valid questions are matched", () => {
    const searchParams = new URLSearchParams();
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("ignores forbidden IDs", () => {
    const searchParams = new URLSearchParams();
    FORBIDDEN_IDS.forEach((id) => {
      searchParams.set(id, "value");
    });
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("correctly handles OpenText questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q1", "Open text answer");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q1: "Open text answer" });
  });

  test("validates MultipleChoiceSingle questions with label", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q2", "Option 1");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q2: "Option 1" });
  });

  test("validates MultipleChoiceSingle questions with option ID", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q2", "c2");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    // Option ID is converted to label
    expect(result).toEqual({ q2: "Option 2" });
  });

  test("invalidates MultipleChoiceSingle with non-existent option", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q2", "Non-existent option");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("handles MultipleChoiceSingle with Other option", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q3", "Custom answer");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q3: "Custom answer" });
  });

  test("handles MultipleChoiceMulti questions with labels", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "Option 4,Option 5");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q4: ["Option 4", "Option 5"] });
  });

  test("handles MultipleChoiceMulti questions with option IDs", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "c4,c5");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    // Option IDs are converted to labels
    expect(result).toEqual({ q4: ["Option 4", "Option 5"] });
  });

  test("handles MultipleChoiceMulti with mixed IDs and labels", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "c4,Option 5");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    // Mixed: ID converted to label + label stays as-is
    expect(result).toEqual({ q4: ["Option 4", "Option 5"] });
  });

  test("handles MultipleChoiceMulti with Other", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q5", "Option 6,Custom answer");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q5: ["Option 6", "Custom answer"] });
  });

  test("validates NPS questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q6", "7");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q6: 7 });
  });

  test("invalidates NPS with out-of-range values", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q6", "11");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("validates Consent questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q8", "accepted");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q8: "accepted" });
  });

  test("invalidates required Consent questions with dismissed value", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q8", "dismissed");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("validates Rating questions within range", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q9", "3");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q9: 3 });
  });

  test("invalidates Rating questions out of range", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q9", "6");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("handles single PictureSelection", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q10", "1");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q10: ["p1"] });
  });

  test("handles multi PictureSelection", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q11", "1,2");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q11: ["p3", "p4"] });
  });

  test("handles multiple valid questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q1", "Open text answer");
    searchParams.set("q2", "Option 2");
    searchParams.set("q6", "9");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({
      q1: "Open text answer",
      q2: "Option 2",
      q6: 9,
    });
  });

  test("handles questions with invalid JSON in NPS/Rating", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q6", "{invalid&json}");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("handles empty required fields", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q1", "");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toBeUndefined();
  });

  test("handles whitespace in comma-separated values", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "Option 4 ,  Option 5");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q4: ["Option 4", "Option 5"] });
  });

  test("ignores trailing commas in multi-select", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "Option 4,Option 5,");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q4: ["Option 4", "Option 5"] });
  });
});
