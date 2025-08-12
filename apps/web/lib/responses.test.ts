import { describe, expect, test, vi } from "vitest";
import { TSurveyQuestionType, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { convertResponseValue, getQuestionResponseMapping, processResponseData } from "./responses";

// Mock the recall and i18n utils
vi.mock("@/lib/utils/recall", () => ({
  parseRecallInfo: vi.fn((text) => text),
}));

vi.mock("./i18n/utils", () => ({
  getLocalizedValue: vi.fn((obj, lang) => obj[lang] || obj.default),
  getLanguageCode: vi.fn((surveyLanguages, languageCode) => {
    if (!surveyLanguages?.length || !languageCode) return null; // Changed from "default" to null
    const language = surveyLanguages.find((surveyLanguage) => surveyLanguage.language.code === languageCode);
    return language?.default ? "default" : language?.language.code || "default";
  }),
}));

describe("Response Processing", () => {
  describe("processResponseData", () => {
    test("should handle string input", () => {
      expect(processResponseData("test")).toBe("test");
    });

    test("should handle number input", () => {
      expect(processResponseData(42)).toBe("42");
    });

    test("should handle array input", () => {
      expect(processResponseData(["a", "b", "c"])).toBe("a; b; c");
    });

    test("should filter out empty values from array", () => {
      const input = ["a", "", "c"];
      expect(processResponseData(input)).toBe("a; c");
    });

    test("should handle object input", () => {
      const input = { key1: "value1", key2: "value2" };
      expect(processResponseData(input)).toBe("key1: value1\nkey2: value2");
    });

    test("should filter out empty values from object", () => {
      const input = { key1: "value1", key2: "", key3: "value3" };
      expect(processResponseData(input)).toBe("key1: value1\nkey3: value3");
    });

    test("should return empty string for unsupported types", () => {
      expect(processResponseData(undefined as any)).toBe("");
    });

    test("should filter out null values from array", () => {
      const input = ["a", null, "c"] as any;
      expect(processResponseData(input)).toBe("a; c");
    });

    test("should filter out undefined values from array", () => {
      const input = ["a", undefined, "c"] as any;
      expect(processResponseData(input)).toBe("a; c");
    });
  });

  describe("convertResponseValue", () => {
    const mockOpenTextQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText as const,
      headline: { default: "Test Question" },
      required: true,
      inputType: "text" as const,
      longAnswer: false,
      charLimit: { enabled: false },
    };

    const mockRankingQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.Ranking as const,
      headline: { default: "Test Question" },
      required: true,
      choices: [
        { id: "1", label: { default: "Choice 1" } },
        { id: "2", label: { default: "Choice 2" } },
      ],
      shuffleOption: "none" as const,
    };

    const mockFileUploadQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.FileUpload as const,
      headline: { default: "Test Question" },
      required: true,
      allowMultipleFiles: true,
    };

    const mockPictureSelectionQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.PictureSelection as const,
      headline: { default: "Test Question" },
      required: true,
      allowMulti: false,
      choices: [
        { id: "1", imageUrl: "image1.jpg", label: { default: "Choice 1" } },
        { id: "2", imageUrl: "image2.jpg", label: { default: "Choice 2" } },
      ],
    };

    test("should handle ranking type with string input", () => {
      expect(convertResponseValue("answer", mockRankingQuestion)).toEqual(["answer"]);
    });

    test("should handle ranking type with array input", () => {
      expect(convertResponseValue(["answer1", "answer2"], mockRankingQuestion)).toEqual([
        "answer1",
        "answer2",
      ]);
    });

    test("should handle fileUpload type with string input", () => {
      expect(convertResponseValue("file.jpg", mockFileUploadQuestion)).toEqual(["file.jpg"]);
    });

    test("should handle fileUpload type with array input", () => {
      expect(convertResponseValue(["file1.jpg", "file2.jpg"], mockFileUploadQuestion)).toEqual([
        "file1.jpg",
        "file2.jpg",
      ]);
    });

    test("should handle pictureSelection type with string input", () => {
      expect(convertResponseValue("1", mockPictureSelectionQuestion)).toEqual(["image1.jpg"]);
    });

    test("should handle pictureSelection type with array input", () => {
      expect(convertResponseValue(["1", "2"], mockPictureSelectionQuestion)).toEqual([
        "image1.jpg",
        "image2.jpg",
      ]);
    });

    test("should handle pictureSelection type with invalid choice", () => {
      expect(convertResponseValue("invalid", mockPictureSelectionQuestion)).toEqual([]);
    });

    test("should handle pictureSelection type with number input", () => {
      expect(convertResponseValue(42, mockPictureSelectionQuestion)).toEqual([]);
    });

    test("should handle pictureSelection type with object input", () => {
      expect(convertResponseValue({ key: "value" }, mockPictureSelectionQuestion)).toEqual([]);
    });

    test("should handle pictureSelection type with null input", () => {
      expect(convertResponseValue(null as any, mockPictureSelectionQuestion)).toEqual([]);
    });

    test("should handle pictureSelection type with undefined input", () => {
      expect(convertResponseValue(undefined as any, mockPictureSelectionQuestion)).toEqual([]);
    });

    test("should handle default case with string input", () => {
      expect(convertResponseValue("answer", mockOpenTextQuestion)).toBe("answer");
    });

    test("should handle default case with number input", () => {
      expect(convertResponseValue(42, mockOpenTextQuestion)).toBe("42");
    });

    test("should handle default case with array input", () => {
      expect(convertResponseValue(["a", "b", "c"], mockOpenTextQuestion)).toBe("a; b; c");
    });

    test("should handle default case with object input", () => {
      const input = { key1: "value1", key2: "value2" };
      expect(convertResponseValue(input, mockOpenTextQuestion)).toBe("key1: value1\nkey2: value2");
    });
  });

  describe("getQuestionResponseMapping", () => {
    const mockSurvey = {
      id: "survey1",
      type: "link" as const,
      status: "inProgress" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Survey",
      environmentId: "env1",
      createdBy: null,
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText as const,
          headline: { default: "Question 1" },
          required: true,
          inputType: "text" as const,
          longAnswer: false,
          charLimit: { enabled: false },
        },
        {
          id: "q2",
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti as const,
          headline: { default: "Question 2" },
          required: true,
          choices: [
            { id: "1", label: { default: "Option 1" } },
            { id: "2", label: { default: "Option 2" } },
          ],
          shuffleOption: "none" as const,
        },
      ],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
      displayOption: "displayOnce" as const,
      delay: 0,
      languages: [
        {
          language: {
            id: "lang1",
            code: "default",
            createdAt: new Date(),
            updatedAt: new Date(),
            alias: null,
            projectId: "proj1",
          },
          default: true,
          enabled: true,
        },
      ],
      variables: [],
      endings: [],
      displayLimit: null,
      autoClose: null,
      autoComplete: null,
      recontactDays: null,
      runOnDate: null,
      closeOnDate: null,
      welcomeCard: {
        enabled: false,
        timeToFinish: false,
        showResponseCount: false,
      },
      showLanguageSwitch: false,
      isBackButtonHidden: false,
      isVerifyEmailEnabled: false,
      isSingleResponsePerEmailEnabled: false,
      displayPercentage: 100,
      styling: null,
      projectOverwrites: null,
      verifyEmail: null,
      inlineTriggers: [],
      pin: null,
      triggers: [],
      followUps: [],
      segment: null,
      recaptcha: null,
      surveyClosedMessage: null,
      singleUse: {
        enabled: false,
        isEncrypted: false,
      },
    };

    const mockResponse = {
      id: "response1",
      surveyId: "survey1",
      createdAt: new Date(),
      updatedAt: new Date(),
      finished: true,
      data: {
        q1: "Answer 1",
        q2: ["Option 1", "Option 2"],
      },
      language: "default",
      meta: {
        url: undefined,
        country: undefined,
        action: undefined,
        source: undefined,
        userAgent: undefined,
      },
      tags: [],
      person: null,
      personAttributes: {},
      ttc: {},
      variables: {},
      contact: null,
      contactAttributes: {},
      singleUseId: null,
    };

    test("should map questions to responses correctly", () => {
      const mapping = getQuestionResponseMapping(mockSurvey, mockResponse);
      expect(mapping).toHaveLength(2);
      expect(mapping[0]).toEqual({
        question: "Question 1",
        response: "Answer 1",
        type: TSurveyQuestionTypeEnum.OpenText,
      });
      expect(mapping[1]).toEqual({
        question: "Question 2",
        response: "Option 1; Option 2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      });
    });

    test("should handle missing response data", () => {
      const response = {
        id: "response1",
        surveyId: "survey1",
        createdAt: new Date(),
        updatedAt: new Date(),
        finished: true,
        data: {},
        language: "default",
        meta: {
          url: undefined,
          country: undefined,
          action: undefined,
          source: undefined,
          userAgent: undefined,
        },
        tags: [],
        person: null,
        personAttributes: {},
        ttc: {},
        variables: {},
        contact: null,
        contactAttributes: {},
        singleUseId: null,
      };
      const mapping = getQuestionResponseMapping(mockSurvey, response);
      expect(mapping).toHaveLength(2);
      expect(mapping[0].response).toBe("");
      expect(mapping[1].response).toBe("");
    });

    test("should handle different language", () => {
      const survey = {
        ...mockSurvey,
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText as const,
            headline: { default: "Question 1", en: "Question 1 EN" },
            required: true,
            inputType: "text" as const,
            longAnswer: false,
            charLimit: { enabled: false },
          },
        ],
        languages: [
          {
            language: {
              id: "lang1",
              code: "default",
              createdAt: new Date(),
              updatedAt: new Date(),
              alias: null,
              projectId: "proj1",
            },
            default: true,
            enabled: true,
          },
          {
            language: {
              id: "lang2",
              code: "en",
              createdAt: new Date(),
              updatedAt: new Date(),
              alias: null,
              projectId: "proj1",
            },
            default: false,
            enabled: true,
          },
        ],
      };
      const response = {
        id: "response1",
        surveyId: "survey1",
        createdAt: new Date(),
        updatedAt: new Date(),
        finished: true,
        data: { q1: "Answer 1" },
        language: "en",
        meta: {
          url: undefined,
          country: undefined,
          action: undefined,
          source: undefined,
          userAgent: undefined,
        },
        tags: [],
        person: null,
        personAttributes: {},
        ttc: {},
        variables: {},
        contact: null,
        contactAttributes: {},
        singleUseId: null,
      };
      const mapping = getQuestionResponseMapping(survey, response);
      expect(mapping[0].question).toBe("Question 1 EN");
    });

    test("should handle null response language", () => {
      const response = {
        id: "response1",
        surveyId: "survey1",
        createdAt: new Date(),
        updatedAt: new Date(),
        finished: true,
        data: { q1: "Answer 1" },
        language: null,
        meta: {
          url: undefined,
          country: undefined,
          action: undefined,
          source: undefined,
          userAgent: undefined,
        },
        tags: [],
        person: null,
        personAttributes: {},
        ttc: {},
        variables: {},
        contact: null,
        contactAttributes: {},
        singleUseId: null,
      };
      const mapping = getQuestionResponseMapping(mockSurvey, response);
      expect(mapping).toHaveLength(2);
      expect(mapping[0].question).toBe("Question 1");
    });

    test("should handle undefined response language", () => {
      const response = {
        id: "response1",
        surveyId: "survey1",
        createdAt: new Date(),
        updatedAt: new Date(),
        finished: true,
        data: { q1: "Answer 1" },
        language: null,
        meta: {
          url: undefined,
          country: undefined,
          action: undefined,
          source: undefined,
          userAgent: undefined,
        },
        tags: [],
        person: null,
        personAttributes: {},
        ttc: {},
        variables: {},
        contact: null,
        contactAttributes: {},
        singleUseId: null,
      };
      const mapping = getQuestionResponseMapping(mockSurvey, response);
      expect(mapping).toHaveLength(2);
      expect(mapping[0].question).toBe("Question 1");
    });

    test("should handle empty survey languages", () => {
      const survey = {
        ...mockSurvey,
        languages: [], // Empty languages array
      };
      const response = {
        id: "response1",
        surveyId: "survey1",
        createdAt: new Date(),
        updatedAt: new Date(),
        finished: true,
        data: { q1: "Answer 1" },
        language: "en",
        meta: {
          url: undefined,
          country: undefined,
          action: undefined,
          source: undefined,
          userAgent: undefined,
        },
        tags: [],
        person: null,
        personAttributes: {},
        ttc: {},
        variables: {},
        contact: null,
        contactAttributes: {},
        singleUseId: null,
      };
      const mapping = getQuestionResponseMapping(survey, response);
      expect(mapping).toHaveLength(2);
      expect(mapping[0].question).toBe("Question 1"); // Should fallback to default
    });
  });
});
