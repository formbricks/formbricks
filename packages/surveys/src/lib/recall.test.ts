import { beforeEach, describe, expect, test, vi } from "vitest";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import * as dateTimeModule from "./date-time";
import * as i18nModule from "./i18n";
import * as recallModule from "./recall";

describe("recall", () => {
  describe("replaceRecallInfo", () => {
    test("should replace recall information with variable value", () => {
      const text = "Hello #recall:firstName/fallback:there#";
      const responseData: TResponseData = {};
      const variables: TResponseVariables = { firstName: "John" };

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello John");
    });

    test("should replace recall information with response data value", () => {
      const text = "Hello #recall:firstName/fallback:there#";
      const responseData: TResponseData = { firstName: "Jane" };
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello Jane");
    });

    test("should use fallback value when no matching variable or response data", () => {
      const text = "Hello #recall:firstName/fallback:there#";
      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello there");
    });

    test("should handle multiple recall patterns in the same text", () => {
      const text = "Hello #recall:firstName/fallback:there#, how are you #recall:mood/fallback:today#?";
      const responseData: TResponseData = { firstName: "Jane" };
      const variables: TResponseVariables = { mood: "feeling" };

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello Jane, how are you feeling?");
    });

    test("should format date values using formatDateWithOrdinal", () => {
      const text = "You signed up on #recall:signupDate/fallback:recently#";
      const responseData: TResponseData = { signupDate: "2023-01-15" };
      const variables: TResponseVariables = {};

      // Spy on isValidDateString and formatDateWithOrdinal
      const isValidDateStringSpy = vi.spyOn(dateTimeModule, "isValidDateString");
      isValidDateStringSpy.mockReturnValue(true);

      const formatDateWithOrdinalSpy = vi.spyOn(dateTimeModule, "formatDateWithOrdinal");
      formatDateWithOrdinalSpy.mockReturnValue("Sunday, January 15th, 2023");

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("You signed up on Sunday, January 15th, 2023");
      expect(isValidDateStringSpy).toHaveBeenCalledWith("2023-01-15");
      expect(formatDateWithOrdinalSpy).toHaveBeenCalledWith(expect.any(Date));

      // Restore the original functions
      isValidDateStringSpy.mockRestore();
      formatDateWithOrdinalSpy.mockRestore();
    });

    test("should join array values with commas", () => {
      const text = "You selected #recall:preferences/fallback:nothing#";
      const responseData: TResponseData = { preferences: ["apple", "banana", "cherry"] };
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("You selected apple, banana, cherry");
    });

    test("should filter out empty values in arrays", () => {
      const text = "You selected #recall:preferences/fallback:nothing#";
      const responseData: TResponseData = { preferences: ["apple", "", "cherry"] };
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("You selected apple, cherry");
    });

    test("should handle spaces in fallback values using nbsp", () => {
      const text = "Hello #recall:firstName/fallback:dearnbspuser#";
      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello dear user");
    });

    test("should return the text unchanged if no recall pattern is found", () => {
      const text = "Hello there, how are you today?";
      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello there, how are you today?");
    });

    test("should return the text unchanged if recall info is malformed", () => {
      const text = "Hello #recall:firstName/wrongformat#";
      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello #recall:firstName/wrongformat#");
    });

    test("should prioritize variables over responseData if both exist", () => {
      const text = "Hello #recall:firstName/fallback:there#";
      const responseData: TResponseData = { firstName: "Jane" };
      const variables: TResponseVariables = { firstName: "John" };

      const result = recallModule.replaceRecallInfo(text, responseData, variables);

      expect(result).toBe("Hello John");
    });
  });

  describe("parseRecallInformation", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    test("should parse recall information in headline", () => {
      const question: TSurveyQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Hello #recall:firstName/fallback:there#",
          en: "Hello #recall:firstName/fallback:there#",
        },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      };

      const responseData: TResponseData = {};
      const variables: TResponseVariables = { firstName: "John" };
      const languageCode = "en";

      // Spy on getLocalizedValue
      const getLocalizedValueSpy = vi.spyOn(i18nModule, "getLocalizedValue");
      getLocalizedValueSpy.mockReturnValue("Hello #recall:firstName/fallback:there#");

      // Spy on replaceRecallInfo
      const replaceRecallInfoSpy = vi.spyOn(recallModule, "replaceRecallInfo");
      replaceRecallInfoSpy.mockImplementation((text) =>
        text.replace(/#recall:firstName\/fallback:there#/, "John")
      );

      const result = recallModule.parseRecallInformation(question, languageCode, responseData, variables);

      expect(result.headline[languageCode]).toBe("Hello John");
      expect(getLocalizedValueSpy).toHaveBeenCalled();
      expect(replaceRecallInfoSpy).toHaveBeenCalled();

      // Restore the original functions
      getLocalizedValueSpy.mockRestore();
      replaceRecallInfoSpy.mockRestore();
    });

    test("should parse recall information in subheader if present", () => {
      const question: TSurveyQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Question",
          en: "Question",
        },
        subheader: {
          default: "Hello #recall:firstName/fallback:there#",
          en: "Hello #recall:firstName/fallback:there#",
        },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      };

      const responseData: TResponseData = {};
      const variables: TResponseVariables = { firstName: "John" };
      const languageCode = "en";

      // Spy on getLocalizedValue
      const getLocalizedValueSpy = vi.spyOn(i18nModule, "getLocalizedValue");
      getLocalizedValueSpy.mockImplementation((value, lang) => {
        if (value === question.subheader) {
          return "Hello #recall:firstName/fallback:there#";
        }
        return "Question";
      });

      // Spy on replaceRecallInfo
      const replaceRecallInfoSpy = vi.spyOn(recallModule, "replaceRecallInfo");
      replaceRecallInfoSpy.mockImplementation((text) =>
        text.replace(/#recall:firstName\/fallback:there#/, "John")
      );

      const result = recallModule.parseRecallInformation(question, languageCode, responseData, variables);

      expect(result.subheader?.[languageCode]).toBe("Hello John");
      expect(getLocalizedValueSpy).toHaveBeenCalled();
      expect(replaceRecallInfoSpy).toHaveBeenCalled();

      // Restore the original functions
      getLocalizedValueSpy.mockRestore();
      replaceRecallInfoSpy.mockRestore();
    });

    test("should not modify headline if no recall information is present", () => {
      const question: TSurveyQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Regular question",
          en: "Regular question",
        },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      };

      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};
      const languageCode = "en";

      const result = recallModule.parseRecallInformation(question, languageCode, responseData, variables);

      expect(result.headline[languageCode]).toBe("Regular question");
    });

    test("should not modify subheader if no recall information is present", () => {
      const question: TSurveyQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Regular question",
          en: "Regular question",
        },
        subheader: {
          default: "Regular subheader",
          en: "Regular subheader",
        },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      };

      const responseData: TResponseData = {};
      const variables: TResponseVariables = {};
      const languageCode = "en";

      const result = recallModule.parseRecallInformation(question, languageCode, responseData, variables);

      expect(result.subheader?.[languageCode]).toBe("Regular subheader");
    });

    test("should handle if question has no subheader", () => {
      const question: TSurveyQuestion = {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "Hello #recall:firstName/fallback:there#",
          en: "Hello #recall:firstName/fallback:there#",
        },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      };

      const responseData: TResponseData = {};
      const variables: TResponseVariables = { firstName: "John" };
      const languageCode = "en";

      // Mock dependencies
      vi.spyOn(i18nModule, "getLocalizedValue").mockReturnValue("Hello #recall:firstName/fallback:there#");
      vi.spyOn(recallModule, "replaceRecallInfo").mockReturnValue("Hello John");

      const result = recallModule.parseRecallInformation(question, languageCode, responseData, variables);

      expect(result.headline[languageCode]).toBe("Hello John");
      expect(result.subheader).toBeUndefined();
    });
  });
});
