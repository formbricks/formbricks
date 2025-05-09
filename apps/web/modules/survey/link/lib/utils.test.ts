import "@testing-library/jest-dom/vitest";
import { describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { getPrefillValue } from "./utils";

describe("survey link utils", () => {
  const mockSurvey = {
    id: "survey1",
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Text Question" },
        required: true,
        logic: [],
        subheader: { default: "" },
      } as unknown as TSurveyQuestion,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Multiple Choice Question" },
        required: false,
        logic: [],
        choices: [
          { id: "c1", label: { default: "Option 1" } },
          { id: "c2", label: { default: "Option 2" } },
        ],
        subheader: { default: "" },
      } as unknown as TSurveyQuestion,
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Multiple Choice with Other" },
        required: false,
        logic: [],
        choices: [
          { id: "c3", label: { default: "Option 3" } },
          { id: "other", label: { default: "Other" } },
        ],
        subheader: { default: "" },
      },
      {
        id: "q4",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Multiple Choice Multi" },
        required: false,
        logic: [],
        choices: [
          { id: "c4", label: { default: "Option 4" } },
          { id: "c5", label: { default: "Option 5" } },
        ],
        subheader: { default: "" },
      },
      {
        id: "q5",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Multiple Choice Multi with Other" },
        required: false,
        logic: [],
        choices: [
          { id: "c6", label: { default: "Option 6" } },
          { id: "other", label: { default: "Other" } },
        ],
        subheader: { default: "" },
      },
      {
        id: "q6",
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: "NPS Question" },
        required: false,
        logic: [],
        lowerLabel: { default: "Not likely" },
        upperLabel: { default: "Very likely" },
        subheader: { default: "" },
      },
      {
        id: "q7",
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "CTA Question" },
        required: false,
        logic: [],
        buttonLabel: { default: "Click me" },
        html: { default: "" },
        subheader: { default: "" },
      },
      {
        id: "q8",
        type: TSurveyQuestionTypeEnum.Consent,
        headline: { default: "Consent Question" },
        required: true,
        logic: [],
        label: { default: "I agree" },
        subheader: { default: "" },
      },
      {
        id: "q9",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Rating Question" },
        required: false,
        logic: [],
        range: 5,
        scale: "number",
        subheader: { default: "" },
      },
      {
        id: "q10",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: { default: "Picture Selection" },
        required: false,
        logic: [],
        choices: [
          { id: "p1", imageUrl: "image1.jpg", label: { default: "Picture 1" } },
          { id: "p2", imageUrl: "image2.jpg", label: { default: "Picture 2" } },
        ],
        allowMulti: false,
        subheader: { default: "" },
      },
      {
        id: "q11",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: { default: "Multi Picture Selection" },
        required: false,
        logic: [],
        choices: [
          { id: "p3", imageUrl: "image3.jpg", label: { default: "Picture 3" } },
          { id: "p4", imageUrl: "image4.jpg", label: { default: "Picture 4" } },
        ],
        allowMulti: true,
        subheader: { default: "" },
      },
    ],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome" },
      html: { default: "" },
      buttonLabel: { default: "Start" },
    },
    thankYouCard: {
      enabled: true,
      headline: { default: "Thank You" },
      html: { default: "" },
      buttonLabel: { default: "Close" },
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

  test("validates MultipleChoiceSingle questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q2", "Option 1");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q2: "Option 1" });
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

  test("handles MultipleChoiceMulti questions", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q4", "Option 4,Option 5");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
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

  test("handles CTA questions with clicked value", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q7", "clicked");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q7: "clicked" });
  });

  test("handles CTA questions with dismissed value", () => {
    const searchParams = new URLSearchParams();
    searchParams.set("q7", "dismissed");
    const result = getPrefillValue(mockSurvey, searchParams, "default");
    expect(result).toEqual({ q7: "" });
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
});
