import { beforeEach, describe, expect, test } from "vitest";
import type { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { parsePrefillFromURL } from "./prefill";

describe("parsePrefillFromURL", () => {
  let mockSurvey: TJsEnvironmentStateSurvey;

  beforeEach(() => {
    // Reset URL search params
    delete (window as any).location;
    (window as any).location = { search: "" };

    mockSurvey = {
      id: "survey-1",
      name: "Test Survey",
      type: "link",
      welcomeCard: { enabled: false },
      endings: [],
      variables: [],
      questions: [],
      hiddenFields: [],
      blocks: [
        {
          id: "block-1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "What is your name?" },
            },
            {
              id: "q2",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Choose one" },
              choices: [
                { id: "choice-us", label: { default: "United States" } },
                { id: "choice-uk", label: { default: "United Kingdom" } },
                { id: "choice-ca", label: { default: "Canada" } },
              ],
            },
            {
              id: "q3",
              type: TSurveyElementTypeEnum.MultipleChoiceMulti,
              headline: { default: "Choose multiple" },
              choices: [
                { id: "sport", label: { default: "Sports" } },
                { id: "music", label: { default: "Music" } },
                { id: "travel", label: { default: "Travel" } },
              ],
            },
          ],
        },
      ],
    } as any;
  });

  test("should parse simple text parameter", () => {
    (window as any).location.search = "?q1=John";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q1: "John" });
  });

  test("should handle URL encoded values", () => {
    (window as any).location.search = "?q1=John%20Doe";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q1: "John Doe" });
  });

  test("should resolve single choice by ID", () => {
    (window as any).location.search = "?q2=choice-us";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q2: "United States" });
  });

  test("should fallback to label matching for single choice", () => {
    (window as any).location.search = "?q2=United%20States";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q2: "United States" });
  });

  test("should resolve multiple choices by ID", () => {
    (window as any).location.search = "?q3=sport,music,travel";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q3: ["Sports", "Music", "Travel"] });
  });

  test("should handle multiple parameters", () => {
    (window as any).location.search = "?q1=John&q2=choice-uk&q3=sport,music";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({
      q1: "John",
      q2: "United Kingdom",
      q3: ["Sports", "Music"],
    });
  });

  test("should return undefined when no matching parameters", () => {
    (window as any).location.search = "?unrelated=value";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toBeUndefined();
  });

  test("should ignore invalid choice values", () => {
    (window as any).location.search = "?q2=invalid-choice&q1=John";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q1: "John" });
  });

  test("should handle empty string parameters", () => {
    (window as any).location.search = "?q1=&q2=choice-us";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q2: "United States" });
  });

  test("should handle mixed valid and invalid values in multi-choice", () => {
    (window as any).location.search = "?q3=sport,invalid,music";

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toEqual({ q3: ["Sports", "Music"] });
  });

  test("should return undefined if window is not defined", () => {
    const originalWindow = global.window;
    // @ts-expect-error - testing undefined window
    delete global.window;

    const result = parsePrefillFromURL(mockSurvey, "default");

    expect(result).toBeUndefined();

    global.window = originalWindow;
  });
});
