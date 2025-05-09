import { createI18nString } from "@/lib/i18n/utils";
import * as i18nUtils from "@/lib/i18n/utils";
import "@testing-library/jest-dom/vitest";
import { TFnType } from "@tolgee/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  TI18nString,
  TSurvey,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import {
  determineImageUploaderVisibility,
  getChoiceLabel,
  getEndingCardText,
  getIndex,
  getMatrixLabel,
  getPlaceHolderById,
  getWelcomeCardText,
  isValueIncomplete,
} from "./utils";

vi.mock("@/lib/i18n/utils", async () => {
  const actual = await vi.importActual("@/lib/i18n/utils");
  return {
    ...actual,
    isLabelValidForAllLanguages: vi.fn(),
  };
});

describe("utils", () => {
  describe("getIndex", () => {
    test("returns null if isChoice is false", () => {
      expect(getIndex("choice-1", false)).toBeNull();
    });

    test("returns index as number if id is properly formatted", () => {
      expect(getIndex("choice-1", true)).toBe(1);
      expect(getIndex("row-2", true)).toBe(2);
    });

    test("returns null if id format is invalid", () => {
      expect(getIndex("invalidformat", true)).toBeNull();
    });
  });

  describe("getChoiceLabel", () => {
    test("returns the choice label from a question", () => {
      const surveyLanguageCodes = ["en"];
      const choiceQuestion: TSurveyMultipleChoiceQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: createI18nString("Question?", surveyLanguageCodes),
        required: true,
        choices: [
          { id: "c1", label: createI18nString("Choice 1", surveyLanguageCodes) },
          { id: "c2", label: createI18nString("Choice 2", surveyLanguageCodes) },
        ],
      };

      const result = getChoiceLabel(choiceQuestion, 1, surveyLanguageCodes);
      expect(result).toEqual(createI18nString("Choice 2", surveyLanguageCodes));
    });

    test("returns empty i18n string when choice doesn't exist", () => {
      const surveyLanguageCodes = ["en"];
      const choiceQuestion: TSurveyMultipleChoiceQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: createI18nString("Question?", surveyLanguageCodes),
        required: true,
        choices: [],
      };

      const result = getChoiceLabel(choiceQuestion, 0, surveyLanguageCodes);
      expect(result).toEqual(createI18nString("", surveyLanguageCodes));
    });
  });

  describe("getMatrixLabel", () => {
    test("returns the row label from a matrix question", () => {
      const surveyLanguageCodes = ["en"];
      const matrixQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: createI18nString("Matrix Question", surveyLanguageCodes),
        required: true,
        rows: [
          createI18nString("Row 1", surveyLanguageCodes),
          createI18nString("Row 2", surveyLanguageCodes),
        ],
        columns: [
          createI18nString("Column 1", surveyLanguageCodes),
          createI18nString("Column 2", surveyLanguageCodes),
        ],
      } as unknown as TSurveyQuestion;

      const result = getMatrixLabel(matrixQuestion, 1, surveyLanguageCodes, "row");
      expect(result).toEqual(createI18nString("Row 2", surveyLanguageCodes));
    });

    test("returns the column label from a matrix question", () => {
      const surveyLanguageCodes = ["en"];
      const matrixQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: createI18nString("Matrix Question", surveyLanguageCodes),
        required: true,
        rows: [
          createI18nString("Row 1", surveyLanguageCodes),
          createI18nString("Row 2", surveyLanguageCodes),
        ],
        columns: [
          createI18nString("Column 1", surveyLanguageCodes),
          createI18nString("Column 2", surveyLanguageCodes),
        ],
      } as unknown as TSurveyQuestion;

      const result = getMatrixLabel(matrixQuestion, 0, surveyLanguageCodes, "column");
      expect(result).toEqual(createI18nString("Column 1", surveyLanguageCodes));
    });

    test("returns empty i18n string when label doesn't exist", () => {
      const surveyLanguageCodes = ["en"];
      const matrixQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: createI18nString("Matrix Question", surveyLanguageCodes),
        required: true,
        rows: [],
        columns: [],
      } as unknown as TSurveyQuestion;

      const result = getMatrixLabel(matrixQuestion, 0, surveyLanguageCodes, "row");
      expect(result).toEqual(createI18nString("", surveyLanguageCodes));
    });
  });

  describe("getWelcomeCardText", () => {
    test("returns welcome card text based on id", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [],
        welcomeCard: {
          enabled: true,
          headline: createI18nString("Welcome", surveyLanguageCodes),
          buttonLabel: createI18nString("Start", surveyLanguageCodes),
        } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = getWelcomeCardText(survey, "headline", surveyLanguageCodes);
      expect(result).toEqual(createI18nString("Welcome", surveyLanguageCodes));
    });

    test("returns empty i18n string when property doesn't exist", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [],
        welcomeCard: {
          enabled: true,
          headline: createI18nString("Welcome", surveyLanguageCodes),
        } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      // Accessing a property that doesn't exist on the welcome card
      const result = getWelcomeCardText(survey, "nonExistentProperty", surveyLanguageCodes);
      expect(result).toEqual(createI18nString("", surveyLanguageCodes));
    });
  });

  describe("getEndingCardText", () => {
    test("returns ending card text for endScreen type", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [],
        welcomeCard: {
          enabled: true,
          headline: createI18nString("Welcome", surveyLanguageCodes),
        } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [
          {
            type: "endScreen",
            headline: createI18nString("End Screen", surveyLanguageCodes),
            subheader: createI18nString("Thanks for your input", surveyLanguageCodes),
          } as any,
        ],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = getEndingCardText(survey, "headline", surveyLanguageCodes, 0);
      expect(result).toEqual(createI18nString("End Screen", surveyLanguageCodes));
    });

    test("returns empty i18n string for non-endScreen type", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [],
        welcomeCard: {
          enabled: true,
          headline: createI18nString("Welcome", surveyLanguageCodes),
        } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [
          {
            type: "redirectToUrl",
            url: "https://example.com",
          } as any,
        ],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = getEndingCardText(survey, "headline", surveyLanguageCodes, 0);
      expect(result).toEqual(createI18nString("", surveyLanguageCodes));
    });
  });

  describe("determineImageUploaderVisibility", () => {
    test("returns false for welcome card", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [],
        welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = determineImageUploaderVisibility(-1, survey);
      expect(result).toBe(false);
    });

    test("returns true when question has an image URL", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: createI18nString("Question?", surveyLanguageCodes),
            required: true,
            imageUrl: "https://example.com/image.jpg",
          } as unknown as TSurveyQuestion,
        ],
        welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = determineImageUploaderVisibility(0, survey);
      expect(result).toBe(true);
    });

    test("returns true when question has a video URL", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: createI18nString("Question?", surveyLanguageCodes),
            required: true,
            videoUrl: "https://example.com/video.mp4",
          } as unknown as TSurveyQuestion,
        ],
        welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = determineImageUploaderVisibility(0, survey);
      expect(result).toBe(true);
    });

    test("returns false when question has no image or video URL", () => {
      const surveyLanguageCodes = ["en"];
      const survey = {
        id: "survey1",
        name: "Test Survey",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "draft",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: createI18nString("Question?", surveyLanguageCodes),
            required: true,
          } as unknown as TSurveyQuestion,
        ],
        welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
        styling: {},
        environmentId: "env1",
        type: "app",
        triggers: [],
        recontactDays: null,
        closeOnDate: null,
        endings: [],
        delay: 0,
        pin: null,
      } as unknown as TSurvey;

      const result = determineImageUploaderVisibility(0, survey);
      expect(result).toBe(false);
    });
  });

  describe("getPlaceHolderById", () => {
    test("returns placeholder for headline", () => {
      const t = vi.fn((key) => `Translated: ${key}`) as TFnType;
      const result = getPlaceHolderById("headline", t);
      expect(result).toBe("Translated: environments.surveys.edit.your_question_here_recall_information_with");
    });

    test("returns placeholder for subheader", () => {
      const t = vi.fn((key) => `Translated: ${key}`) as TFnType;
      const result = getPlaceHolderById("subheader", t);
      expect(result).toBe(
        "Translated: environments.surveys.edit.your_description_here_recall_information_with"
      );
    });

    test("returns empty string for unknown id", () => {
      const t = vi.fn((key) => `Translated: ${key}`) as TFnType;
      const result = getPlaceHolderById("unknown", t);
      expect(result).toBe("");
    });
  });

  describe("isValueIncomplete", () => {
    beforeEach(() => {
      vi.mocked(i18nUtils.isLabelValidForAllLanguages).mockReset();
    });

    test("returns false when value is undefined", () => {
      const result = isValueIncomplete("label", true, ["en"]);
      expect(result).toBe(false);
    });

    test("returns false when is not invalid", () => {
      const value: TI18nString = { default: "Test" };
      const result = isValueIncomplete("label", false, ["en"], value);
      expect(result).toBe(false);
    });

    test("returns true when all conditions are met", () => {
      vi.mocked(i18nUtils.isLabelValidForAllLanguages).mockReturnValue(false);
      const value: TI18nString = { default: "Test" };
      const result = isValueIncomplete("label", true, ["en"], value);
      expect(result).toBe(true);
    });

    test("returns false when label is valid for all languages", () => {
      vi.mocked(i18nUtils.isLabelValidForAllLanguages).mockReturnValue(true);
      const value: TI18nString = { default: "Test" };
      const result = isValueIncomplete("label", true, ["en"], value);
      expect(result).toBe(false);
    });

    test("returns false when default value is empty and id is a label type", () => {
      vi.mocked(i18nUtils.isLabelValidForAllLanguages).mockReturnValue(false);
      const value: TI18nString = { default: "" };
      const result = isValueIncomplete("label", true, ["en"], value);
      expect(result).toBe(false);
    });

    test("returns false for non-label id", () => {
      vi.mocked(i18nUtils.isLabelValidForAllLanguages).mockReturnValue(false);
      const value: TI18nString = { default: "Test" };
      const result = isValueIncomplete("nonLabelId", true, ["en"], value);
      expect(result).toBe(false);
    });
  });
});
