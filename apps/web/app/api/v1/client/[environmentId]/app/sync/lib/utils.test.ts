import { parseRecallInfo } from "@/lib/utils/recall";
import { describe, expect, test, vi } from "vitest";
import { TAttributes } from "@formbricks/types/attributes";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyEnding,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { replaceAttributeRecall } from "./utils";

vi.mock("@/lib/utils/recall", () => ({
  parseRecallInfo: vi.fn((text, attributes) => {
    const recallPattern = /recall:([a-zA-Z0-9_-]+)/;
    const match = text.match(recallPattern);
    if (match && match[1]) {
      const recallKey = match[1];
      const attributeValue = attributes[recallKey];
      if (attributeValue !== undefined) {
        return text.replace(recallPattern, `parsed-${attributeValue}`);
      }
    }
    return text; // Return original text if no match or attribute not found
  }),
}));

const baseSurvey: TSurvey = {
  id: "survey1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  environmentId: "env1",
  type: "app",
  status: "inProgress",
  questions: [],
  endings: [],
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
  languages: [
    { language: { id: "lang1", code: "en" } as unknown as TLanguage, default: true, enabled: true },
  ],
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  singleUse: null,
  styling: null,
  surveyClosedMessage: null,
  hiddenFields: { enabled: false },
  variables: [],
  createdBy: null,
  isSingleResponsePerEmailEnabled: false,
  isVerifyEmailEnabled: false,
  projectOverwrites: null,
  runOnDate: null,
  showLanguageSwitch: false,
  isBackButtonHidden: false,
  followUps: [],
  recaptcha: { enabled: false, threshold: 0.5 },
  displayOption: "displayOnce",
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  autoComplete: null,
  segment: null,
  pin: null,
  resultShareKey: null,
};

const attributes: TAttributes = {
  name: "John Doe",
  email: "john.doe@example.com",
  plan: "premium",
};

describe("replaceAttributeRecall", () => {
  test("should replace recall info in question headlines and subheaders", () => {
    const surveyWithRecall: TSurvey = {
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Hello recall:name!" },
          subheader: { default: "Your email is recall:email" },
          required: true,
          buttonLabel: { default: "Next" },
          placeholder: { default: "Type here..." },
          longAnswer: false,
          logic: [],
        } as unknown as TSurveyQuestion,
      ],
    };

    const result = replaceAttributeRecall(surveyWithRecall, attributes);
    expect(result.questions[0].headline.default).toBe("Hello parsed-John Doe!");
    expect(result.questions[0].subheader?.default).toBe("Your email is parsed-john.doe@example.com");
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Hello recall:name!", attributes);
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Your email is recall:email", attributes);
  });

  test("should replace recall info in welcome card headline", () => {
    const surveyWithRecall: TSurvey = {
      ...baseSurvey,
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome, recall:name!" },
        html: { default: "<p>Some content</p>" },
        buttonLabel: { default: "Start" },
        timeToFinish: false,
        showResponseCount: false,
      },
    };

    const result = replaceAttributeRecall(surveyWithRecall, attributes);
    expect(result.welcomeCard.headline?.default).toBe("Welcome, parsed-John Doe!");
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Welcome, recall:name!", attributes);
  });

  test("should replace recall info in end screen headlines and subheaders", () => {
    const surveyWithRecall: TSurvey = {
      ...baseSurvey,
      endings: [
        {
          type: "endScreen",
          headline: { default: "Thank you, recall:name!" },
          subheader: { default: "Your plan: recall:plan" },
          buttonLabel: { default: "Finish" },
          buttonLink: "https://example.com",
        } as unknown as TSurveyEnding,
      ],
    };

    const result = replaceAttributeRecall(surveyWithRecall, attributes);
    expect(result.endings[0].type).toBe("endScreen");
    if (result.endings[0].type === "endScreen") {
      expect(result.endings[0].headline?.default).toBe("Thank you, parsed-John Doe!");
      expect(result.endings[0].subheader?.default).toBe("Your plan: parsed-premium");
      expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Thank you, recall:name!", attributes);
      expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Your plan: recall:plan", attributes);
    }
  });

  test("should handle multiple languages", () => {
    const surveyMultiLang: TSurvey = {
      ...baseSurvey,
      languages: [
        { language: { id: "lang1", code: "en" } as unknown as TLanguage, default: true, enabled: true },
        { language: { id: "lang2", code: "es" } as unknown as TLanguage, default: false, enabled: true },
      ],
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Hello recall:name!", es: "Hola recall:name!" },
          required: true,
          buttonLabel: { default: "Next", es: "Siguiente" },
          placeholder: { default: "Type here...", es: "Escribe aquí..." },
          longAnswer: false,
          logic: [],
        } as unknown as TSurveyQuestion,
      ],
    };

    const result = replaceAttributeRecall(surveyMultiLang, attributes);
    expect(result.questions[0].headline.default).toBe("Hello parsed-John Doe!");
    expect(result.questions[0].headline.es).toBe("Hola parsed-John Doe!");
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Hello recall:name!", attributes);
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Hola recall:name!", attributes);
  });

  test("should not replace if recall key is not in attributes", () => {
    const surveyWithRecall: TSurvey = {
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Your company: recall:company" },
          required: true,
          buttonLabel: { default: "Next" },
          placeholder: { default: "Type here..." },
          longAnswer: false,
          logic: [],
        } as unknown as TSurveyQuestion,
      ],
    };

    const result = replaceAttributeRecall(surveyWithRecall, attributes);
    expect(result.questions[0].headline.default).toBe("Your company: recall:company");
    expect(vi.mocked(parseRecallInfo)).toHaveBeenCalledWith("Your company: recall:company", attributes);
  });

  test("should handle surveys with no recall information", async () => {
    const surveyNoRecall: TSurvey = {
      ...baseSurvey,
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Just a regular question" },
          required: true,
          buttonLabel: { default: "Next" },
          placeholder: { default: "Type here..." },
          longAnswer: false,
          logic: [],
        } as unknown as TSurveyQuestion,
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome!" },
        html: { default: "<p>Some content</p>" },
        buttonLabel: { default: "Start" },
        timeToFinish: false,
        showResponseCount: false,
      },
      endings: [
        {
          type: "endScreen",
          headline: { default: "Thank you!" },
          buttonLabel: { default: "Finish" },
        } as unknown as TSurveyEnding,
      ],
    };
    const parseRecallInfoSpy = vi.spyOn(await import("@/lib/utils/recall"), "parseRecallInfo");

    const result = replaceAttributeRecall(surveyNoRecall, attributes);
    expect(result).toEqual(surveyNoRecall); // Should be unchanged
    expect(parseRecallInfoSpy).not.toHaveBeenCalled();
    parseRecallInfoSpy.mockRestore();
  });

  test("should handle surveys with empty questions, endings, or disabled welcome card", async () => {
    const surveyEmpty: TSurvey = {
      ...baseSurvey,
      questions: [],
      endings: [],
      welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
    };
    const parseRecallInfoSpy = vi.spyOn(await import("@/lib/utils/recall"), "parseRecallInfo");

    const result = replaceAttributeRecall(surveyEmpty, attributes);
    expect(result).toEqual(surveyEmpty);
    expect(parseRecallInfoSpy).not.toHaveBeenCalled();
    parseRecallInfoSpy.mockRestore();
  });
});
