import { getLocalizedValue } from "@/lib/i18n/utils";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import { describe, expect, test, vi } from "vitest";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import {
  checkForEmptyFallBackValue,
  extractFallbackValue,
  extractId,
  extractIds,
  extractRecallInfo,
  fallbacks,
  findRecallInfoById,
  getFallbackValues,
  getRecallItems,
  headlineToRecall,
  parseRecallInfo,
  recallToHeadline,
  replaceHeadlineRecall,
  replaceRecallInfoWithUnderline,
} from "./recall";

// Mock dependencies
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn().mockImplementation((obj, lang) => {
    return typeof obj === "string" ? obj : obj[lang] || obj["default"] || "";
  }),
}));

vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));

vi.mock("@/lib/utils/datetime", () => ({
  isValidDateString: vi.fn((value) => {
    try {
      return !isNaN(new Date(value as string).getTime());
    } catch {
      return false;
    }
  }),
  formatDateWithOrdinal: vi.fn((date) => {
    return "January 1st, 2023";
  }),
}));

describe("recall utility functions", () => {
  describe("extractId", () => {
    test("extracts ID correctly from a string with recall pattern", () => {
      const text = "This is a #recall:question123 example";
      const result = extractId(text);
      expect(result).toBe("question123");
    });

    test("returns null when no ID is found", () => {
      const text = "This has no recall pattern";
      const result = extractId(text);
      expect(result).toBeNull();
    });

    test("returns null for malformed recall pattern", () => {
      const text = "This is a #recall: malformed pattern";
      const result = extractId(text);
      expect(result).toBeNull();
    });
  });

  describe("extractIds", () => {
    test("extracts multiple IDs from a string with multiple recall patterns", () => {
      const text = "This has #recall:id1 and #recall:id2 and #recall:id3";
      const result = extractIds(text);
      expect(result).toEqual(["id1", "id2", "id3"]);
    });

    test("returns empty array when no IDs are found", () => {
      const text = "This has no recall patterns";
      const result = extractIds(text);
      expect(result).toEqual([]);
    });

    test("handles mixed content correctly", () => {
      const text = "Text #recall:id1 more text #recall:id2";
      const result = extractIds(text);
      expect(result).toEqual(["id1", "id2"]);
    });
  });

  describe("extractFallbackValue", () => {
    test("extracts fallback value correctly", () => {
      const text = "Text #recall:id1/fallback:defaultValue# more text";
      const result = extractFallbackValue(text);
      expect(result).toBe("defaultValue");
    });

    test("returns empty string when no fallback value is found", () => {
      const text = "Text with no fallback";
      const result = extractFallbackValue(text);
      expect(result).toBe("");
    });

    test("handles empty fallback value", () => {
      const text = "Text #recall:id1/fallback:# more text";
      const result = extractFallbackValue(text);
      expect(result).toBe("");
    });
  });

  describe("extractRecallInfo", () => {
    test("extracts complete recall info from text", () => {
      const text = "This is #recall:id1/fallback:default# text";
      const result = extractRecallInfo(text);
      expect(result).toBe("#recall:id1/fallback:default#");
    });

    test("returns null when no recall info is found", () => {
      const text = "This has no recall info";
      const result = extractRecallInfo(text);
      expect(result).toBeNull();
    });

    test("extracts recall info for a specific ID when provided", () => {
      const text = "This has #recall:id1/fallback:default1# and #recall:id2/fallback:default2#";
      const result = extractRecallInfo(text, "id2");
      expect(result).toBe("#recall:id2/fallback:default2#");
    });
  });

  describe("findRecallInfoById", () => {
    test("finds recall info by ID", () => {
      const text = "Text #recall:id1/fallback:value1# and #recall:id2/fallback:value2#";
      const result = findRecallInfoById(text, "id2");
      expect(result).toBe("#recall:id2/fallback:value2#");
    });

    test("returns null when ID is not found", () => {
      const text = "Text #recall:id1/fallback:value1#";
      const result = findRecallInfoById(text, "id2");
      expect(result).toBeNull();
    });
  });

  describe("recallToHeadline", () => {
    test("converts recall pattern to headline format without slash", () => {
      const headline = { en: "How do you like #recall:product/fallback:ournbspproduct#?" };
      const survey: TSurvey = {
        id: "test-survey",
        questions: [{ id: "product", headline: { en: "Product Question" } }] as unknown as TSurveyQuestion[],
        hiddenFields: { fieldIds: [] },
        variables: [],
      } as unknown as TSurvey;

      const result = recallToHeadline(headline, survey, false, "en");
      expect(result.en).toBe("How do you like @Product Question?");
    });

    test("converts recall pattern to headline format with slash", () => {
      const headline = { en: "Rate #recall:product/fallback:ournbspproduct#" };
      const survey: TSurvey = {
        id: "test-survey",
        questions: [{ id: "product", headline: { en: "Product Question" } }] as unknown as TSurveyQuestion[],
        hiddenFields: { fieldIds: [] },
        variables: [],
      } as unknown as TSurvey;

      const result = recallToHeadline(headline, survey, true, "en");
      expect(result.en).toBe("Rate /Product Question\\");
    });

    test("handles hidden fields in recall", () => {
      const headline = { en: "Your email is #recall:email/fallback:notnbspprovided#" };
      const survey: TSurvey = {
        id: "test-survey",
        questions: [],
        hiddenFields: { fieldIds: ["email"] },
        variables: [],
      } as unknown as TSurvey;

      const result = recallToHeadline(headline, survey, false, "en");
      expect(result.en).toBe("Your email is @email");
    });

    test("handles variables in recall", () => {
      const headline = { en: "Your plan is #recall:plan/fallback:unknown#" };
      const survey: TSurvey = {
        id: "test-survey",
        questions: [],
        hiddenFields: { fieldIds: [] },
        variables: [{ id: "plan", name: "Subscription Plan" }],
      } as unknown as TSurvey;

      const result = recallToHeadline(headline, survey, false, "en");
      expect(result.en).toBe("Your plan is @Subscription Plan");
    });

    test("returns unchanged headline when no recall pattern is found", () => {
      const headline = { en: "Regular headline with no recall" };
      const survey = {} as TSurvey;

      const result = recallToHeadline(headline, survey, false, "en");
      expect(result).toEqual(headline);
    });

    test("handles nested recall patterns", () => {
      const headline = {
        en: "This is #recall:outer/fallback:withnbsp#recall:inner/fallback:nested#nbsptext#",
      };
      const survey: TSurvey = {
        id: "test-survey",
        questions: [
          { id: "outer", headline: { en: "Outer with @inner" } },
          { id: "inner", headline: { en: "Inner value" } },
        ] as unknown as TSurveyQuestion[],
        hiddenFields: { fieldIds: [] },
        variables: [],
      } as unknown as TSurvey;

      const result = recallToHeadline(headline, survey, false, "en");
      expect(result.en).toBe("This is @Outer with @inner");
    });
  });

  describe("replaceRecallInfoWithUnderline", () => {
    test("replaces recall info with underline", () => {
      const text = "This is a #recall:id1/fallback:default# example";
      const result = replaceRecallInfoWithUnderline(text);
      expect(result).toBe("This is a ___ example");
    });

    test("replaces multiple recall infos with underlines", () => {
      const text = "This #recall:id1/fallback:v1# has #recall:id2/fallback:v2# multiple recalls";
      const result = replaceRecallInfoWithUnderline(text);
      expect(result).toBe("This ___ has ___ multiple recalls");
    });

    test("returns unchanged text when no recall info is present", () => {
      const text = "This has no recall info";
      const result = replaceRecallInfoWithUnderline(text);
      expect(result).toBe(text);
    });
  });

  describe("checkForEmptyFallBackValue", () => {
    test("identifies question with empty fallback value", () => {
      const questionHeadline = { en: "Question with #recall:id1/fallback:# empty fallback" };
      const survey: TSurvey = {
        questions: [
          {
            id: "q1",
            headline: questionHeadline,
          },
        ] as unknown as TSurveyQuestion[],
      } as unknown as TSurvey;

      vi.mocked(getLocalizedValue).mockReturnValueOnce(questionHeadline.en);

      const result = checkForEmptyFallBackValue(survey, "en");
      expect(result).toBe(survey.questions[0]);
    });

    test("identifies question with empty fallback in subheader", () => {
      const questionSubheader = { en: "Subheader with #recall:id1/fallback:# empty fallback" };
      const survey: TSurvey = {
        questions: [
          {
            id: "q1",
            headline: { en: "Normal question" },
            subheader: questionSubheader,
          },
        ] as unknown as TSurveyQuestion[],
      } as unknown as TSurvey;

      vi.mocked(getLocalizedValue).mockReturnValueOnce(questionSubheader.en);

      const result = checkForEmptyFallBackValue(survey, "en");
      expect(result).toBe(survey.questions[0]);
    });

    test("returns null when no empty fallback values are found", () => {
      const questionHeadline = { en: "Question with #recall:id1/fallback:default# valid fallback" };
      const survey: TSurvey = {
        questions: [
          {
            id: "q1",
            headline: questionHeadline,
          },
        ] as unknown as TSurveyQuestion[],
      } as unknown as TSurvey;

      vi.mocked(getLocalizedValue).mockReturnValueOnce(questionHeadline.en);

      const result = checkForEmptyFallBackValue(survey, "en");
      expect(result).toBeNull();
    });
  });

  describe("replaceHeadlineRecall", () => {
    test("processes all questions in a survey", () => {
      const survey: TSurvey = {
        questions: [
          {
            id: "q1",
            headline: { en: "Question with #recall:id1/fallback:default#" },
          },
          {
            id: "q2",
            headline: { en: "Another with #recall:id2/fallback:other#" },
          },
        ] as unknown as TSurveyQuestion[],
        hiddenFields: { fieldIds: [] },
        variables: [],
      } as unknown as TSurvey;

      vi.mocked(structuredClone).mockImplementation((obj) => JSON.parse(JSON.stringify(obj)));

      const result = replaceHeadlineRecall(survey, "en");

      // Verify recallToHeadline was called for each question
      expect(result).not.toBe(survey); // Should be a clone
      expect(result.questions[0].headline).not.toEqual(survey.questions[0].headline);
      expect(result.questions[1].headline).not.toEqual(survey.questions[1].headline);
    });
  });

  describe("getRecallItems", () => {
    test("extracts recall items from text", () => {
      const text = "Text with #recall:id1/fallback:val1# and #recall:id2/fallback:val2#";
      const survey: TSurvey = {
        questions: [
          { id: "id1", headline: { en: "Question One" } },
          { id: "id2", headline: { en: "Question Two" } },
        ] as unknown as TSurveyQuestion[],
        hiddenFields: { fieldIds: [] },
        variables: [],
      } as unknown as TSurvey;

      const result = getRecallItems(text, survey, "en");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("id1");
      expect(result[0].label).toBe("Question One");
      expect(result[0].type).toBe("question");
      expect(result[1].id).toBe("id2");
      expect(result[1].label).toBe("Question Two");
      expect(result[1].type).toBe("question");
    });

    test("handles hidden fields in recall items", () => {
      const text = "Text with #recall:hidden1/fallback:val1#";
      const survey: TSurvey = {
        questions: [],
        hiddenFields: { fieldIds: ["hidden1"] },
        variables: [],
      } as unknown as TSurvey;

      const result = getRecallItems(text, survey, "en");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("hidden1");
      expect(result[0].type).toBe("hiddenField");
    });

    test("handles variables in recall items", () => {
      const text = "Text with #recall:var1/fallback:val1#";
      const survey: TSurvey = {
        questions: [],
        hiddenFields: { fieldIds: [] },
        variables: [{ id: "var1", name: "Variable One" }],
      } as unknown as TSurvey;

      const result = getRecallItems(text, survey, "en");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("var1");
      expect(result[0].label).toBe("Variable One");
      expect(result[0].type).toBe("variable");
    });

    test("returns empty array when no recall items are found", () => {
      const text = "Text with no recall items";
      const survey: TSurvey = {} as TSurvey;

      const result = getRecallItems(text, survey, "en");
      expect(result).toEqual([]);
    });
  });

  describe("getFallbackValues", () => {
    test("extracts fallback values from text", () => {
      const text = "Text #recall:id1/fallback:value1# and #recall:id2/fallback:value2#";
      const result = getFallbackValues(text);

      expect(result).toEqual({
        id1: "value1",
        id2: "value2",
      });
    });

    test("returns empty object when no fallback values are found", () => {
      const text = "Text with no fallback values";
      const result = getFallbackValues(text);
      expect(result).toEqual({});
    });
  });

  describe("headlineToRecall", () => {
    test("transforms headlines to recall info", () => {
      const text = "What do you think of @Product?";
      const recallItems: TSurveyRecallItem[] = [{ id: "product", label: "Product", type: "question" }];
      const fallbacks: fallbacks = {
        product: "our product",
      };

      const result = headlineToRecall(text, recallItems, fallbacks);
      expect(result).toBe("What do you think of #recall:product/fallback:our product#?");
    });

    test("transforms multiple headlines", () => {
      const text = "Rate @Product made by @Company";
      const recallItems: TSurveyRecallItem[] = [
        { id: "product", label: "Product", type: "question" },
        { id: "company", label: "Company", type: "question" },
      ];
      const fallbacks: fallbacks = {
        product: "our product",
        company: "our company",
      };

      const result = headlineToRecall(text, recallItems, fallbacks);
      expect(result).toBe(
        "Rate #recall:product/fallback:our product# made by #recall:company/fallback:our company#"
      );
    });
  });

  describe("parseRecallInfo", () => {
    test("replaces recall info with response data", () => {
      const text = "Your answer was #recall:q1/fallback:not-provided#";
      const responseData: TResponseData = {
        q1: "Yes definitely",
      };

      const result = parseRecallInfo(text, responseData);
      expect(result).toBe("Your answer was Yes definitely");
    });

    test("uses fallback when response data is missing", () => {
      const text = "Your answer was #recall:q1/fallback:notnbspprovided#";
      const responseData: TResponseData = {
        q2: "Some other answer",
      };

      const result = parseRecallInfo(text, responseData);
      expect(result).toBe("Your answer was not provided");
    });

    test("formats date values", () => {
      const text = "You joined on #recall:joinDate/fallback:an-unknown-date#";
      const responseData: TResponseData = {
        joinDate: "2023-01-01",
      };

      const result = parseRecallInfo(text, responseData);
      expect(result).toBe("You joined on January 1st, 2023");
    });

    test("formats array values as comma-separated list", () => {
      const text = "Your selections: #recall:preferences/fallback:none#";
      const responseData: TResponseData = {
        preferences: ["Option A", "Option B", "Option C"],
      };

      const result = parseRecallInfo(text, responseData);
      expect(result).toBe("Your selections: Option A, Option B, Option C");
    });

    test("uses variables when available", () => {
      const text = "Welcome back, #recall:username/fallback:user#";
      const variables: TResponseVariables = {
        username: "John Doe",
      };

      const result = parseRecallInfo(text, {}, variables);
      expect(result).toBe("Welcome back, John Doe");
    });

    test("prioritizes variables over response data", () => {
      const text = "Your email is #recall:email/fallback:no-email#";
      const responseData: TResponseData = {
        email: "response@example.com",
      };
      const variables: TResponseVariables = {
        email: "variable@example.com",
      };

      const result = parseRecallInfo(text, responseData, variables);
      expect(result).toBe("Your email is variable@example.com");
    });

    test("handles withSlash parameter", () => {
      const text = "Your name is #recall:name/fallback:anonymous#";
      const variables: TResponseVariables = {
        name: "John Doe",
      };

      const result = parseRecallInfo(text, {}, variables, true);
      expect(result).toBe("Your name is #/John Doe\\#");
    });

    test("handles 'nbsp' in fallback values", () => {
      const text = "Default spacing: #recall:space/fallback:nonnbspbreaking#";

      const result = parseRecallInfo(text);
      expect(result).toBe("Default spacing: non breaking");
    });
  });
});
