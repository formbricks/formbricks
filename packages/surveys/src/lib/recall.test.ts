import { describe, expect, it, vi } from "vitest";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyQuestion, TSurveyQuestionTypeEnum } from "../../../types/surveys/types";
import { parseRecallInformation, replaceRecallInfo } from "./recall";

// Mock getLocalizedValue (assuming path and simple behavior)
vi.mock("./i18n", () => ({
  getLocalizedValue: (localizedString: Record<string, string> | undefined, languageCode: string): string => {
    if (!localizedString) return "";
    return localizedString[languageCode] || ""; // Simplified mock: return value for lang or empty string
  },
}));

// Mock date-time functions as they are used internally and we want to isolate recall logic
vi.mock("./date-time", () => ({
  isValidDateString: (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{2}-\d{2}-\d{4}$/.test(val),
  formatDateWithOrdinal: (date: Date) =>
    `${date.getFullYear()}-${("0" + (date.getMonth() + 1)).slice(-2)}-${("0" + date.getDate()).slice(-2)}_formatted`,
}));

describe("replaceRecallInfo", () => {
  const responseData: TResponseData = {
    name: "John Doe",
    email: "john.doe@example.com",
    age: 30,
    registrationDate: "2023-01-15",
    tags: ["beta", "user"],
    emptyArray: [],
  };

  const variables: TResponseVariables = {
    productName: "Formbricks",
    userRole: "Admin",
    lastLogin: "2024-03-10",
  };

  it("should replace recall info from responseData", () => {
    const text = "Welcome, #recall:name/fallback:Guest#! Your email is #recall:email/fallback:N/A#.";
    const expected = "Welcome, John Doe! Your email is john.doe@example.com.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should replace recall info from variables if not in responseData", () => {
    const text = "Product: #recall:productName/fallback:N/A#. Role: #recall:userRole/fallback:User#.";
    const expected = "Product: Formbricks. Role: Admin.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should use fallback if value is not found in responseData or variables", () => {
    const text = "Your organization is #recall:orgName/fallback:DefaultOrg#.";
    const expected = "Your organization is DefaultOrg.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle nbsp in fallback", () => {
    const text = "Status: #recall:status/fallback:PendingnbspReview#.";
    const expected = "Status: Pending Review.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should format date strings from responseData", () => {
    const text = "Registered on: #recall:registrationDate/fallback:N/A#.";
    const expected = "Registered on: 2023-01-15_formatted.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should format date strings from variables", () => {
    const text = "Last login: #recall:lastLogin/fallback:N/A#.";
    const expected = "Last login: 2024-03-10_formatted.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should join array values with a comma and space", () => {
    const text = "Tags: #recall:tags/fallback:none#.";
    const expected = "Tags: beta, user.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle empty array values, replacing with fallback", () => {
    const text = "Categories: #recall:emptyArray/fallback:No&nbsp;Categories#.";
    const expected = "Categories: No& ;Categories.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle null values from responseData, replacing with fallback", () => {
    const text = "Preference: #recall:nullValue/fallback:Not&nbsp;Set#.";
    const expected = "Preference: Not& ;Set.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle multiple recall patterns in a single string", () => {
    const text =
      "Hi #recall:name/fallback:User#, welcome to #recall:productName/fallback:Our Product#. Your role is #recall:userRole/fallback:Member#.";
    const expected = "Hi John Doe, welcome to #recall:productName/fallback:Our Product#. Your role is Admin.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should return original text if no recall pattern is found", () => {
    const text = "This is a normal text without recall info.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(text);
  });

  it("should handle recall ID not found, using fallback", () => {
    const text = "Value: #recall:nonExistent/fallback:FallbackValue#.";
    const expected = "Value: FallbackValue.";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle if recall info is incomplete (e.g. missing fallback part), effectively using empty fallback", () => {
    // This specific pattern is not fully matched by extractRecallInfo, leading to no replacement.
    // The current extractRecallInfo expects #recall:ID/fallback:VALUE#
    const text = "Test: #recall:name#";
    const expected = "Test: #recall:name#"; // No change as pattern is not fully matched by extractRecallInfo
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });

  it("should handle complex fallback with spaces and special characters encoded as nbsp", () => {
    const text =
      "Details: #recall:extraInfo/fallback:ValuenbspWithnbspSpaces# and #recall:anotherInfo/fallback:Default#";
    const expected = "Details: Value With Spaces and Default";
    expect(replaceRecallInfo(text, responseData, variables)).toBe(expected);
  });
});

describe("parseRecallInformation", () => {
  // Re-use responseData and variables from the outer scope
  const responseData: TResponseData = {
    name: "John Doe",
    email: "john.doe@example.com",
    age: 30,
    registrationDate: "2023-01-15",
    tags: ["beta", "user"],
    emptyArray: [],
    city: "Testville",
  };

  const variables: TResponseVariables = {
    productName: "Formbricks",
    userRole: "Admin",
    lastLogin: "2024-03-10",
    surveyType: "Onboarding",
  };

  const baseQuestion: TSurveyQuestion = {
    id: "survey1",
    type: TSurveyQuestionTypeEnum.OpenText,
    headline: { en: "Original Headline" },
    required: false,
    inputType: "text",
    charLimit: { enabled: false },
    // other necessary TSurveyQuestion fields can be added here with default values
  };

  it("should replace recall info in headline", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Welcome, #recall:name/fallback:Guest#!" },
    };
    const expectedHeadline = "Welcome, John Doe!";
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe(expectedHeadline);
  });

  it("should replace recall info in subheader", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Main Question" },
      subheader: { en: "Details: #recall:productName/fallback:N/A#." },
    };
    const expectedSubheader = "Details: Formbricks.";
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.subheader?.en).toBe(expectedSubheader);
  });

  it("should replace recall info in both headline and subheader", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "User: #recall:name/fallback:User#" },
      subheader: { en: "Survey: #recall:surveyType/fallback:General#" },
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("User: John Doe");
    expect(result.subheader?.en).toBe("Survey: Onboarding");
  });

  it("should not change text if no recall info is present", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "A simple question." },
      subheader: { en: "With a simple subheader." },
    };
    const result = parseRecallInformation(
      JSON.parse(JSON.stringify(question)),
      "en",
      responseData,
      variables
    );
    expect(result.headline.en).toBe(question.headline.en);
    expect(result.subheader?.en).toBe(question.subheader?.en);
  });

  it("should handle undefined subheader gracefully", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Question with #recall:name/fallback:User#" },
      subheader: undefined,
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("Question with John Doe");
    expect(result.subheader).toBeUndefined();
  });

  it("should not modify subheader if languageCode content is missing, even if recall is in other lang", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Hello #recall:name/fallback:User#" },
      subheader: { fr: "Bonjour #recall:name/fallback:Utilisateur#", en: "" },
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("Hello John Doe");
    expect(result.subheader?.en).toBe("");
    expect(result.subheader?.fr).toBe("Bonjour #recall:name/fallback:Utilisateur#");
  });

  it("should handle malformed recall string (empty ID) leading to no replacement for that pattern", () => {
    // This tests extractId returning null because extractRecallInfo won't match '#recall:/fallback:foo#'
    // due to idPattern requiring at least one char for ID.
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Malformed: #recall:/fallback:foo# and valid: #recall:name/fallback:User#" },
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("Malformed: #recall:/fallback:foo# and valid: John Doe");
  });

  it("should use empty string for empty fallback value", () => {
    // This tests extractFallbackValue returning ""
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Data: #recall:nonExistentData/fallback:#" },
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("Data: "); // nonExistentData not found, empty fallback used
  });

  it("should handle recall info if subheader is present but no text for languageCode", () => {
    const question: TSurveyQuestion = {
      ...baseQuestion,
      headline: { en: "Headline #recall:name/fallback:User#" },
      subheader: { fr: "French subheader #recall:productName/fallback:Produit#", en: "" },
    };
    const result = parseRecallInformation(question, "en", responseData, variables);
    expect(result.headline.en).toBe("Headline John Doe");
    expect(result.subheader?.fr).toBe("French subheader #recall:productName/fallback:Produit#");
    expect(result.subheader?.en).toBe("");
  });
});
