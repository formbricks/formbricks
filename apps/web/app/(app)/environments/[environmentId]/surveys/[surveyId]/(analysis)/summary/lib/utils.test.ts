import { describe, expect, test } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  constructToastMessage,
  convertFloatTo2Decimal,
  convertFloatToNDecimal,
  needsInsightsGeneration,
} from "./utils";

describe("convertFloatToNDecimal", () => {
  test("rounds a number to N decimal places", () => {
    expect(convertFloatToNDecimal(3.14159, 2)).toBe(3.14);
    expect(convertFloatToNDecimal(3.14159, 3)).toBe(3.142);
    expect(convertFloatToNDecimal(3.14159, 0)).toBe(3);
    expect(convertFloatToNDecimal(3.5, 0)).toBe(4);
  });

  test("uses 2 decimal places by default", () => {
    expect(convertFloatToNDecimal(3.14159)).toBe(3.14);
    expect(convertFloatToNDecimal(3.999)).toBe(4.0);
  });

  test("handles zero correctly", () => {
    expect(convertFloatToNDecimal(0, 2)).toBe(0);
  });

  test("handles negative numbers", () => {
    expect(convertFloatToNDecimal(-3.14159, 2)).toBe(-3.14);
    expect(convertFloatToNDecimal(-3.14159, 3)).toBe(-3.142);
  });
});

describe("convertFloatTo2Decimal", () => {
  test("rounds a number to 2 decimal places", () => {
    expect(convertFloatTo2Decimal(3.14159)).toBe(3.14);
    expect(convertFloatTo2Decimal(3.999)).toBe(4);
    expect(convertFloatTo2Decimal(3)).toBe(3);
  });

  test("handles zero correctly", () => {
    expect(convertFloatTo2Decimal(0)).toBe(0);
  });

  test("handles negative numbers", () => {
    expect(convertFloatTo2Decimal(-3.14159)).toBe(-3.14);
    expect(convertFloatTo2Decimal(-3.999)).toBe(-4);
  });
});

describe("constructToastMessage", () => {
  const mockSurvey: TSurvey = {
    id: "survey-1",
    questions: [
      { id: "q1", type: "openText", headline: { default: "Question 1" } },
      { id: "q2", type: "matrix", headline: { default: "Question 2" } },
    ],
  } as TSurvey;

  const mockT = (key: string, values?: Record<string, any>): string => {
    if (values) {
      let result = key;
      Object.entries(values).forEach(([k, v]) => {
        result += ` ${k}:${v}`;
      });
      return result;
    }
    return key;
  };

  test("constructs message for matrix question type", () => {
    const result = constructToastMessage(
      TSurveyQuestionTypeEnum.Matrix,
      "equals",
      mockSurvey,
      "q2",
      mockT,
      "Row 1"
    );

    expect(result).toBe(
      "environments.surveys.summary.added_filter_for_responses_where_answer_to_question questionIdx:2 filterComboBoxValue:Row 1 filterValue:equals"
    );
  });

  test("constructs message for question with undefined filterComboBoxValue", () => {
    const result = constructToastMessage(
      TSurveyQuestionTypeEnum.OpenText,
      "equals",
      mockSurvey,
      "q1",
      mockT,
      undefined
    );

    expect(result).toBe(
      "environments.surveys.summary.added_filter_for_responses_where_answer_to_question_is_skipped questionIdx:1"
    );
  });

  test("constructs message for question with string filterComboBoxValue", () => {
    const result = constructToastMessage(
      TSurveyQuestionTypeEnum.OpenText,
      "contains",
      mockSurvey,
      "q1",
      mockT,
      "feedback"
    );

    expect(result).toBe(
      "environments.surveys.summary.added_filter_for_responses_where_answer_to_question questionIdx:1 filterComboBoxValue:feedback filterValue:contains"
    );
  });

  test("constructs message for question with array filterComboBoxValue", () => {
    const result = constructToastMessage(
      TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      "includes_all",
      mockSurvey,
      "q1",
      mockT,
      ["option1", "option2"]
    );

    expect(result).toBe(
      "environments.surveys.summary.added_filter_for_responses_where_answer_to_question questionIdx:1 filterComboBoxValue:option1,option2 filterValue:includes_all"
    );
  });
});

describe("needsInsightsGeneration", () => {
  test("returns true if survey has open text questions without insightsEnabled property", () => {
    const survey: TSurvey = {
      id: "survey-1",
      questions: [
        {
          id: "q1",
          type: "openText",
          headline: { default: "Open Question 1" },
          required: true,
          // insightsEnabled is undefined
        },
      ],
    } as TSurvey;

    expect(needsInsightsGeneration(survey)).toBe(true);
  });

  test("returns false if survey has no open text questions", () => {
    const survey: TSurvey = {
      id: "survey-1",
      questions: [
        {
          id: "q1",
          type: "multipleChoiceSingle",
          headline: { default: "Multiple Choice Question" },
          choices: [],
          required: true,
        },
      ],
    } as TSurvey;

    expect(needsInsightsGeneration(survey)).toBe(false);
  });

  test("returns false if all open text questions have insightsEnabled property", () => {
    const survey: TSurvey = {
      id: "survey-1",
      questions: [
        {
          id: "q1",
          type: "openText",
          headline: { default: "Open Question 1" },
          required: true,
          insightsEnabled: true,
        },
        {
          id: "q2",
          type: "openText",
          headline: { default: "Open Question 2" },
          required: true,
          insightsEnabled: false,
        },
      ],
    } as TSurvey;

    expect(needsInsightsGeneration(survey)).toBe(false);
  });

  test("returns true if any open text question has undefined insightsEnabled", () => {
    const survey: TSurvey = {
      id: "survey-1",
      questions: [
        {
          id: "q1",
          type: "openText",
          headline: { default: "Open Question 1" },
          required: true,
          insightsEnabled: true,
        },
        {
          id: "q2",
          type: "openText",
          headline: { default: "Open Question 2" },
          required: true,
          // insightsEnabled is undefined
        },
      ],
    } as TSurvey;

    expect(needsInsightsGeneration(survey)).toBe(true);
  });
});
