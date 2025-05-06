import { describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { constructToastMessage, convertFloatTo2Decimal, convertFloatToNDecimal } from "./utils";

describe("Utils Tests", () => {
  describe("convertFloatToNDecimal", () => {
    test("should round to N decimal places", () => {
      expect(convertFloatToNDecimal(3.14159, 2)).toBe(3.14);
      expect(convertFloatToNDecimal(3.14159, 3)).toBe(3.142);
      expect(convertFloatToNDecimal(3.1, 2)).toBe(3.1);
      expect(convertFloatToNDecimal(3, 2)).toBe(3);
      expect(convertFloatToNDecimal(0.129, 2)).toBe(0.13);
    });

    test("should default to 2 decimal places if N is not provided", () => {
      expect(convertFloatToNDecimal(3.14159)).toBe(3.14);
    });
  });

  describe("convertFloatTo2Decimal", () => {
    test("should round to 2 decimal places", () => {
      expect(convertFloatTo2Decimal(3.14159)).toBe(3.14);
      expect(convertFloatTo2Decimal(3.1)).toBe(3.1);
      expect(convertFloatTo2Decimal(3)).toBe(3);
      expect(convertFloatTo2Decimal(0.129)).toBe(0.13);
    });
  });

  describe("constructToastMessage", () => {
    const mockT = vi.fn((key, params) => `${key} ${JSON.stringify(params)}`) as any;
    const mockSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "app",
      environmentId: "env1",
      status: "draft",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Q1" },
          required: false,
        } as unknown as TSurveyQuestion,
        {
          id: "q2",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Q2" },
          required: false,
          choices: [{ id: "c1", label: { default: "Choice 1" } }],
        },
        {
          id: "q3",
          type: TSurveyQuestionTypeEnum.Matrix,
          headline: { default: "Q3" },
          required: false,
          rows: [{ id: "r1", label: { default: "Row 1" } }],
          columns: [{ id: "col1", label: { default: "Col 1" } }],
        },
      ],
      triggers: [],
      recontactDays: null,
      autoClose: null,
      closeOnDate: null,
      delay: 0,
      autoComplete: null,
      singleUse: null,
      styling: null,
      surveyClosedMessage: null,
      resultShareKey: null,
      displayOption: "displayOnce",
      welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: [],
    } as unknown as TSurvey;

    test("should construct message for matrix question type", () => {
      const message = constructToastMessage(
        TSurveyQuestionTypeEnum.Matrix,
        "is",
        mockSurvey,
        "q3",
        mockT,
        "MatrixValue"
      );
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question",
        {
          questionIdx: 3,
          filterComboBoxValue: "MatrixValue",
          filterValue: "is",
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question {"questionIdx":3,"filterComboBoxValue":"MatrixValue","filterValue":"is"}'
      );
    });

    test("should construct message for matrix question type with array filterComboBoxValue", () => {
      const message = constructToastMessage(TSurveyQuestionTypeEnum.Matrix, "is", mockSurvey, "q3", mockT, [
        "MatrixValue1",
        "MatrixValue2",
      ]);
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question",
        {
          questionIdx: 3,
          filterComboBoxValue: "MatrixValue1,MatrixValue2",
          filterValue: "is",
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question {"questionIdx":3,"filterComboBoxValue":"MatrixValue1,MatrixValue2","filterValue":"is"}'
      );
    });

    test("should construct message when filterComboBoxValue is undefined (skipped)", () => {
      const message = constructToastMessage(
        TSurveyQuestionTypeEnum.OpenText,
        "is skipped",
        mockSurvey,
        "q1",
        mockT,
        undefined
      );
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question_is_skipped",
        {
          questionIdx: 1,
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question_is_skipped {"questionIdx":1}'
      );
    });

    test("should construct message for non-matrix question with string filterComboBoxValue", () => {
      const message = constructToastMessage(
        TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        "is",
        mockSurvey,
        "q2",
        mockT,
        "Choice1"
      );
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question",
        {
          questionIdx: 2,
          filterComboBoxValue: "Choice1",
          filterValue: "is",
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question {"questionIdx":2,"filterComboBoxValue":"Choice1","filterValue":"is"}'
      );
    });

    test("should construct message for non-matrix question with array filterComboBoxValue", () => {
      const message = constructToastMessage(
        TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        "includes all of",
        mockSurvey,
        "q2", // Assuming q2 can be multi for this test case logic
        mockT,
        ["Choice1", "Choice2"]
      );
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question",
        {
          questionIdx: 2,
          filterComboBoxValue: "Choice1,Choice2",
          filterValue: "includes all of",
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question {"questionIdx":2,"filterComboBoxValue":"Choice1,Choice2","filterValue":"includes all of"}'
      );
    });

    test("should handle questionId not found in survey", () => {
      const message = constructToastMessage(
        TSurveyQuestionTypeEnum.OpenText,
        "is",
        mockSurvey,
        "qNonExistent",
        mockT,
        "SomeValue"
      );
      // findIndex returns -1, so questionIdx becomes -1 + 1 = 0
      expect(mockT).toHaveBeenCalledWith(
        "environments.surveys.summary.added_filter_for_responses_where_answer_to_question",
        {
          questionIdx: 0,
          filterComboBoxValue: "SomeValue",
          filterValue: "is",
        }
      );
      expect(message).toBe(
        'environments.surveys.summary.added_filter_for_responses_where_answer_to_question {"questionIdx":0,"filterComboBoxValue":"SomeValue","filterValue":"is"}'
      );
    });
  });
});
