import { TFunction } from "i18next";
import { toast } from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TI18nString } from "@formbricks/types/i18n";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TSurveyConsentElement,
  TSurveyElementTypeEnum,
  TSurveyMultipleChoiceElement,
  TSurveyOpenTextElement,
} from "@formbricks/types/surveys/elements";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyLanguage,
  TSurveyRedirectUrlCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";
import * as validation from "./validation";

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock recall utility
vi.mock("@/lib/utils/recall", async (importOriginal) => ({
  ...(await importOriginal()),
  checkForEmptyFallBackValue: vi.fn(),
}));

const surveyLanguagesEnabled: TSurveyLanguage[] = [
  {
    language: {
      id: "1",
      code: "en",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: true,
    enabled: true,
  },
  {
    language: {
      id: "2",
      code: "de",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: false,
    enabled: true,
  },
];

const surveyLanguagesOnlyDefault: TSurveyLanguage[] = [
  {
    language: {
      id: "1",
      code: "en",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: true,
    enabled: true,
  },
];

const surveyLanguagesWithDisabled: TSurveyLanguage[] = [
  {
    language: {
      id: "1",
      code: "en",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: true,
    enabled: true,
  },
  {
    language: {
      id: "2",
      code: "de",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: false,
    enabled: true,
  },
  {
    language: {
      id: "3",
      code: "fr",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
    default: false,
    enabled: false,
  },
];

describe("validation.isLabelValidForAllLanguages", () => {
  test("should return true if all enabled languages have non-empty labels", () => {
    const label: TI18nString = { default: "Hello", en: "Hello", de: "Hallo" };
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesEnabled)).toBe(true);
  });

  test("should return false if an enabled language has an empty label", () => {
    const label: TI18nString = { default: "Hello", en: "Hello", de: "" };
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false if an enabled language has a label with only whitespace", () => {
    const label: TI18nString = { default: "Hello", en: "Hello", de: "  " };
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false if label is undefined for an enabled language", () => {
    const label: TI18nString = { default: "Hello", en: "Hello" }; // de is missing
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return true if only default language and label is present", () => {
    const label: TI18nString = { default: "Hello", en: "Hello" };
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesOnlyDefault)).toBe(true);
  });

  test("should return false if only default language and label is missing", () => {
    const label: TI18nString = { default: "", en: "" };
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesOnlyDefault)).toBe(false);
  });

  test("should ignore disabled languages", () => {
    const label: TI18nString = { default: "Hello", en: "Hello", de: "Hallo", fr: "" }; // fr is disabled but empty
    expect(validation.isLabelValidForAllLanguages(label, surveyLanguagesWithDisabled)).toBe(true);
  });

  test("should use 'default' if language code is 'default'", () => {
    const labelDefaultCode: TI18nString = { default: "Hello" };
    const surveyLangsWithDefaultCode: TSurveyLanguage[] = [
      {
        language: {
          id: "1",
          code: "default",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: "proj1",
        },
        default: true,
        enabled: true,
      },
    ];
    expect(validation.isLabelValidForAllLanguages(labelDefaultCode, surveyLangsWithDefaultCode)).toBe(true);
  });

  test("should return true if no languages are provided (checks for 'default' key)", () => {
    const label: TI18nString = { default: "Fallback" };
    expect(validation.isLabelValidForAllLanguages(label, [])).toBe(true);
  });

  test("should return false if no languages are provided and 'default' key is missing or empty", () => {
    const labelMissing: TI18nString = {};
    const labelEmpty: TI18nString = { default: "" };
    expect(validation.isLabelValidForAllLanguages(labelMissing, [])).toBe(false);
    expect(validation.isLabelValidForAllLanguages(labelEmpty, [])).toBe(false);
  });
});

describe("validation.isWelcomeCardValid", () => {
  const baseWelcomeCard: TSurveyWelcomeCard = {
    enabled: true,
    headline: { default: "Welcome", en: "Welcome", de: "Willkommen" },
    subheader: { default: "<p>Info</p>", en: "<p>Info</p>", de: "<p>Infos</p>" },
    timeToFinish: false,
    showResponseCount: false,
  };

  test("should return true for a valid welcome card", () => {
    expect(validation.isWelcomeCardValid(baseWelcomeCard, surveyLanguagesEnabled)).toBe(true);
  });

  test("should return false if headline is invalid", () => {
    const card = { ...baseWelcomeCard, headline: { default: "Welcome", en: "Welcome", de: "" } };
    expect(validation.isWelcomeCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false if subheader is invalid (when subheader is provided)", () => {
    const card = { ...baseWelcomeCard, subheader: { default: "<p>Info</p>", en: "<p>Info</p>", de: "  " } };
    expect(validation.isWelcomeCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return true if subheader is undefined", () => {
    const card = { ...baseWelcomeCard, subheader: undefined };
    expect(validation.isWelcomeCardValid(card, surveyLanguagesEnabled)).toBe(true);
  });
});

describe("validation.isEndingCardValid", () => {
  const baseEndScreenCard: TSurveyEndScreenCard = {
    id: "end1",
    type: "endScreen",
    headline: { default: "Thank You", en: "Thank You", de: "Danke" },
    subheader: { default: "Done", en: "Done", de: "Fertig" },
  };

  const baseRedirectUrlCard: TSurveyRedirectUrlCard = {
    id: "redir1",
    type: "redirectToUrl",
    url: "https://example.com",
    label: "Redirect",
  };

  // EndScreen Card tests
  test("should return true for a valid endScreen card without button", () => {
    expect(validation.isEndingCardValid(baseEndScreenCard, surveyLanguagesEnabled)).toBe(true);
  });

  test("should return true for a valid endScreen card with valid button", () => {
    const card: TSurveyEndScreenCard = {
      ...baseEndScreenCard,
      buttonLabel: { default: "Go", en: "Go", de: "Los" },
      buttonLink: "https://example.com",
    };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(true);
  });

  test("should return false for endScreen card if headline is invalid", () => {
    const card = { ...baseEndScreenCard, headline: { default: "Thank You", en: "Thank You", de: "" } };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false for endScreen card if subheader is invalid (when provided)", () => {
    const card = { ...baseEndScreenCard, subheader: { default: "Done", en: "Done", de: "  " } };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false for endScreen card if buttonLabel is invalid (when provided)", () => {
    const card: TSurveyEndScreenCard = {
      ...baseEndScreenCard,
      buttonLabel: { default: "Go", en: "Go", de: "" },
      buttonLink: "https://example.com",
    };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false for endScreen card if buttonLink is invalid (when buttonLabel is provided)", () => {
    const card: TSurveyEndScreenCard = {
      ...baseEndScreenCard,
      buttonLabel: { default: "Go", en: "Go", de: "Los" },
      buttonLink: "invalid-url",
    };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  // RedirectURL Card tests
  test("should return true for a valid redirectUrl card", () => {
    expect(validation.isEndingCardValid(baseRedirectUrlCard, surveyLanguagesEnabled)).toBe(true);
  });

  test("should return false for redirectUrl card if URL is invalid", () => {
    const card = { ...baseRedirectUrlCard, url: "invalid-url" };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return false for redirectUrl card if label is empty", () => {
    const card = { ...baseRedirectUrlCard, label: "  " };
    expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });
  // test("should return false for redirectUrl card if label is undefined", () => {
  //   const card = { ...baseRedirectUrlCard, label: undefined };
  //   expect(validation.isEndingCardValid(card, surveyLanguagesEnabled)).toBe(false);
  // });
});

describe("validation.validateElement", () => {
  const baseElementFields = {
    id: "element1",
    required: false,
  };

  // Test OpenText Element
  describe("OpenText Element", () => {
    const openTextElementBase: TSurveyOpenTextElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Open Text", en: "Open Text", de: "Offener Text" },
      subheader: { default: "Enter here", en: "Enter here", de: "Hier eingeben" },
      placeholder: { default: "Your answer...", en: "Your answer...", de: "Deine Antwort..." },
      inputType: "text",
      charLimit: {
        enabled: true,
        max: 100,
        min: 0,
      },
    };

    test("should return true for a valid OpenText element", () => {
      expect(validation.validateElement(openTextElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if headline is invalid", () => {
      const q = { ...openTextElementBase, headline: { default: "Open Text", en: "Open Text", de: "" } };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if placeholder is valid (default not empty, other languages valid)", () => {
      const q = {
        ...openTextElementBase,
        placeholder: { default: "Type here", en: "Type here", de: "Tippe hier" },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if placeholder.default is not empty but other lang is empty", () => {
      const q = { ...openTextElementBase, placeholder: { default: "Type here", en: "Type here", de: "" } };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if placeholder.default is empty (placeholder validation skipped)", () => {
      const q = { ...openTextElementBase, placeholder: { default: "", en: "Type here", de: "" } };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });
  });

  // Test MultipleChoiceSingle Element
  describe("MultipleChoiceSingle Element", () => {
    const mcSingleElementBase: TSurveyMultipleChoiceElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      headline: { default: "Single Choice", en: "Single Choice", de: "Einzelauswahl" },
      choices: [
        { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
        { id: "c2", label: { default: "Option 2", en: "Option 2", de: "Option 2" } },
      ],
    };

    test("should return true for a valid MultipleChoiceSingle element", () => {
      expect(validation.validateElement(mcSingleElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if a choice label is invalid", () => {
      const q = {
        ...mcSingleElementBase,
        choices: [
          { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
          { id: "c2", label: { default: "Option 2", en: "Option 2", de: "" } },
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });

  // Test Consent Element
  describe("Consent Element", () => {
    const consentElementBase: TSurveyConsentElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.Consent,
      headline: { default: "Consent", en: "Consent", de: "Zustimmung" },
      label: { default: "I agree", en: "I agree", de: "Ich stimme zu" },
      subheader: { default: "Details...", en: "Details...", de: "Details..." },
    };

    test("should return true for a valid Consent element", () => {
      expect(validation.validateElement(consentElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if consent label is invalid", () => {
      const q = { ...consentElementBase, label: { default: "I agree", en: "I agree", de: "" } };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });
});

describe("validation.validateSurveyElementsInBatch", () => {
  const q2Valid: TSurveyOpenTextElement = {
    id: "q2",
    type: TSurveyElementTypeEnum.OpenText,
    headline: { default: "Q2", en: "Q2", de: "Q2" },
    inputType: "text",
    charLimit: {
      enabled: true,
      max: 100,
      min: 0,
    },
    required: false,
  };

  const q2Invalid: TSurveyOpenTextElement = {
    id: "q2",
    type: TSurveyElementTypeEnum.OpenText,
    headline: { default: "Q2", en: "Q2", de: "" },
    inputType: "text",
    charLimit: {
      enabled: true,
      max: 100,
      min: 0,
    },
    required: false,
  };

  test("should return empty array if invalidElements is null", () => {
    expect(validation.validateSurveyElementsInBatch(q2Valid, null, surveyLanguagesEnabled)).toEqual([]);
  });

  test("should add element.id if element is invalid and not already in list", () => {
    const invalidElements = ["q1"];
    expect(
      validation.validateSurveyElementsInBatch(q2Invalid, invalidElements, surveyLanguagesEnabled)
    ).toEqual(["q1", "q2"]);
  });

  test("should not add element.id if element is invalid but already in list", () => {
    const invalidElements = ["q1", "q2"];
    expect(
      validation.validateSurveyElementsInBatch(q2Invalid, invalidElements, surveyLanguagesEnabled)
    ).toEqual(["q1", "q2"]);
  });

  test("should remove element.id if element is valid and in list", () => {
    const invalidElements = ["q1", "q2"];
    expect(
      validation.validateSurveyElementsInBatch(q2Valid, invalidElements, surveyLanguagesEnabled)
    ).toEqual(["q1"]);
  });

  test("should not change list if element is valid and not in list", () => {
    const invalidElements = ["q1"];
    const validateElementSpy = vi.spyOn(validation, "validateElement");
    validateElementSpy.mockReturnValue(true);
    const result = validation.validateSurveyElementsInBatch(
      q2Valid,
      [...invalidElements],
      surveyLanguagesEnabled
    );
    expect(result).toEqual(["q1"]);
  });
});

describe("validation.isSurveyValid", () => {
  const mockT: TFunction = ((key: string) => key) as TFunction;
  let baseSurvey: TSurvey;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue(null); // Default: no empty fallback

    baseSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "web",
      environmentId: "env1",
      status: "draft",
      questions: [],
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Q1", en: "Q1", de: "Q1" },
              required: false,
              inputType: "text",
              charLimit: {
                enabled: false,
              },
            },
          ],
        },
      ],
      endings: [
        { id: "end1", type: "endScreen", headline: { default: "Thanks", en: "Thanks", de: "Danke" } },
      ],
      welcomeCard: { enabled: true, headline: { default: "Welcome", en: "Welcome", de: "Willkommen" } },
      languages: surveyLanguagesEnabled,
      triggers: [],
      recontactDays: null,
      autoClose: null,
      delay: 0,
      displayOption: "displayOnce",
      displayLimit: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      segment: null,
    } as unknown as TSurvey; // Cast to TSurvey, ensure all required fields are present or mocked
  });

  test("should return true for a completely valid survey", () => {
    expect(validation.isSurveyValid(baseSurvey, "en", mockT)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("should return false and toast error if checkForEmptyFallBackValue returns an element", () => {
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue({
      id: "q1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q1", en: "Q1", de: "Q1" },
      inputType: "text",
      charLimit: {
        enabled: true,
        max: 100,
        min: 0,
      },
      required: false,
    });
    expect(validation.isSurveyValid(baseSurvey, "de", mockT)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.fallback_missing");
  });

  test("should return false and toast error if response limit is 0", () => {
    const surveyWithZeroLimit = {
      ...baseSurvey,
      autoComplete: 0,
    };
    expect(validation.isSurveyValid(surveyWithZeroLimit, "en", mockT, 5)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.response_limit_can_t_be_set_to_0");
  });

  test("should return false and toast error if response limit is less than or equal to response count", () => {
    const surveyWithLowLimit = {
      ...baseSurvey,
      autoComplete: 5,
    };
    expect(validation.isSurveyValid(surveyWithLowLimit, "en", mockT, 5)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "environments.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses",
      {
        id: "response-limit-error",
      }
    );
  });

  test("should return false and toast error if response limit is less than response count", () => {
    const surveyWithLowLimit = {
      ...baseSurvey,
      autoComplete: 3,
    };
    expect(validation.isSurveyValid(surveyWithLowLimit, "en", mockT, 5)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "environments.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses",
      {
        id: "response-limit-error",
      }
    );
  });

  test("should return true if response limit is greater than response count", () => {
    const surveyWithValidLimit = {
      ...baseSurvey,
      autoComplete: 10,
    };
    expect(validation.isSurveyValid(surveyWithValidLimit, "en", mockT, 5)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("should return true if autoComplete is null (no limit set)", () => {
    const surveyWithNoLimit = {
      ...baseSurvey,
      autoComplete: null,
    };
    expect(validation.isSurveyValid(surveyWithNoLimit, "en", mockT, 5)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  describe("App Survey Segment Validation", () => {
    test("should return false and toast error for app survey with invalid segment filters", () => {
      const surveyWithInvalidSegment = {
        ...baseSurvey,
        type: "app",
        segment: {
          id: "temp",
          filters: [{ connector: "and", resource: { id: "invalid", name: "invalid", type: "invalid" } }], // Invalid structure for ZSegmentFilters
          isPrivate: false,
          title: "temp segment",
          description: "",
          surveyId: "survey1",
          environmentId: "env1",
        },
      } as unknown as TSurvey;

      expect(validation.isSurveyValid(surveyWithInvalidSegment, "en", mockT)).toBe(false); // Zod parse will fail
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.edit.invalid_targeting");
    });

    test("should return true for app survey with valid segment filters", () => {
      const surveyWithValidSegment = {
        ...baseSurvey,
        type: "app",
        segment: {
          id: "temp",
          filters: [
            {
              resource: { id: "userId", name: "User ID", type: "person" },
              condition: { id: "equals", name: "Equals" },
              value: "test",
            },
          ], // Valid structure
          isPrivate: false,
          title: "temp segment",
          description: "",
          surveyId: "survey1",
          environmentId: "env1",
        },
      } as unknown as TSurvey;
      const mockSafeParse = vi.spyOn(ZSegmentFilters, "safeParse");
      mockSafeParse.mockReturnValue({ success: true, data: surveyWithValidSegment.segment!.filters } as any);

      expect(validation.isSurveyValid(surveyWithValidSegment, "en", mockT)).toBe(true);
      expect(toast.error).not.toHaveBeenCalled();
      mockSafeParse.mockRestore();
    });
  });
});
