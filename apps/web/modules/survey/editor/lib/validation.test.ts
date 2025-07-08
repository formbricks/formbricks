import { checkForEmptyFallBackValue } from "@/lib/utils/recall";
import { TFnType } from "@tolgee/react";
import { toast } from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TI18nString,
  TSurvey,
  TSurveyAddressQuestion,
  TSurveyCTAQuestion,
  TSurveyConsentQuestion,
  TSurveyContactInfoQuestion,
  TSurveyEndScreenCard,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRedirectUrlCard,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
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
    html: { default: "<p>Info</p>", en: "<p>Info</p>", de: "<p>Infos</p>" },
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

  test("should return false if html is invalid (when html is provided)", () => {
    const card = { ...baseWelcomeCard, html: { default: "<p>Info</p>", en: "<p>Info</p>", de: "  " } };
    expect(validation.isWelcomeCardValid(card, surveyLanguagesEnabled)).toBe(false);
  });

  test("should return true if html is undefined", () => {
    const card = { ...baseWelcomeCard, html: undefined };
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

describe("validation.validateQuestion", () => {
  const baseQuestionFields = {
    id: "question1",
    required: false,
    logic: [],
  };

  // Test OpenText Question
  describe("OpenText Question", () => {
    const openTextQuestionBase: TSurveyOpenTextQuestion = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Open Text", en: "Open Text", de: "Offener Text" },
      subheader: { default: "Enter here", en: "Enter here", de: "Hier eingeben" },
      placeholder: { default: "Your answer...", en: "Your answer...", de: "Deine Antwort..." },
      longAnswer: false,
      inputType: "text",
      charLimit: {
        enabled: true,
        max: 100,
        min: 0,
      },
    };

    test("should return true for a valid OpenText question", () => {
      expect(validation.validateQuestion(openTextQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if headline is invalid", () => {
      const q = { ...openTextQuestionBase, headline: { default: "Open Text", en: "Open Text", de: "" } };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return true if placeholder is valid (default not empty, other languages valid)", () => {
      const q = {
        ...openTextQuestionBase,
        placeholder: { default: "Type here", en: "Type here", de: "Tippe hier" },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if placeholder.default is not empty but other lang is empty", () => {
      const q = { ...openTextQuestionBase, placeholder: { default: "Type here", en: "Type here", de: "" } };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return true if placeholder.default is empty (placeholder validation skipped)", () => {
      const q = { ...openTextQuestionBase, placeholder: { default: "", en: "Type here", de: "" } };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(true);
    });
  });

  // Test MultipleChoiceSingle Question
  describe("MultipleChoiceSingle Question", () => {
    const mcSingleQuestionBase: TSurveyMultipleChoiceQuestion = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Single Choice", en: "Single Choice", de: "Einzelauswahl" },
      choices: [
        { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
        { id: "c2", label: { default: "Option 2", en: "Option 2", de: "Option 2" } },
      ],
    };

    test("should return true for a valid MultipleChoiceSingle question", () => {
      expect(validation.validateQuestion(mcSingleQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if a choice label is invalid", () => {
      const q = {
        ...mcSingleQuestionBase,
        choices: [
          { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
          { id: "c2", label: { default: "Option 2", en: "Option 2", de: "" } },
        ],
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });
  });

  // Test MultipleChoiceMulti Question
  describe("MultipleChoiceMulti Question", () => {
    const mcMultiQuestionBase: TSurveyMultipleChoiceQuestion = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      headline: { default: "Multi Choice", en: "Multi Choice", de: "Mehrfachauswahl" },
      choices: [
        { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
        { id: "c2", label: { default: "Option 2", en: "Option 2", de: "Option 2" } },
      ],
    };

    test("should return true for a valid MultipleChoiceMulti question", () => {
      expect(validation.validateQuestion(mcMultiQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if a choice label is invalid", () => {
      const q = {
        ...mcMultiQuestionBase,
        choices: [
          { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
          { id: "c2", label: { default: "Option 2", en: "Option 2", de: "" } },
        ],
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });
  });

  // Test Consent Question
  describe("Consent Question", () => {
    const consentQuestionBase: TSurveyConsentQuestion = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.Consent,
      headline: { default: "Consent", en: "Consent", de: "Zustimmung" },
      label: { default: "I agree", en: "I agree", de: "Ich stimme zu" },
      html: { default: "Details...", en: "Details...", de: "Details..." },
    };

    test("should return true for a valid Consent question", () => {
      expect(validation.validateQuestion(consentQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if consent label is invalid", () => {
      const q = { ...consentQuestionBase, label: { default: "I agree", en: "I agree", de: "" } };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });
  });

  // Test Matrix Question
  describe("Matrix Question", () => {
    const matrixQuestionBase = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Matrix", en: "Matrix", de: "Matrix" },
      rows: [
        { id: "r1", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } },
        { id: "r2", label: { default: "Row 2", en: "Row 2", de: "Zeile 2" } },
      ],
      columns: [
        { id: "c1", label: { default: "Column 1", en: "Column 1", de: "Spalte 1" } },
        { id: "c2", label: { default: "Column 2", en: "Column 2", de: "Spalte 2" } },
      ],
    } as unknown as TSurveyMatrixQuestion;

    test("should return true for a valid Matrix question", () => {
      expect(validation.validateQuestion(matrixQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if a row label is invalid", () => {
      const q = {
        ...matrixQuestionBase,
        rows: [
          { id: "r1", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } },
          { id: "r2", label: { default: "Row 2", en: "Row 2", de: "" } },
        ],
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return false if a column label is invalid", () => {
      const q = {
        ...matrixQuestionBase,
        columns: [
          { id: "c1", label: { default: "Column 1", en: "Column 1", de: "Spalte 1" } },
          { id: "c2", label: { default: "Column 2", en: "Column 2", de: "" } },
        ],
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });
  });

  // Test ContactInfo Question
  describe("ContactInfo Question", () => {
    const contactInfoQuestionBase = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Contact Info", en: "Contact Info", de: "Kontaktinformationen" },
      firstName: {
        show: true,
        required: false,
        placeholder: { default: "First Name", en: "First Name", de: "Vorname" },
      },
      lastName: {
        show: true,
        required: false,
        placeholder: { default: "Last Name", en: "Last Name", de: "Nachname" },
      },
      email: { show: true, required: false, placeholder: { default: "Email", en: "Email", de: "E-Mail" } },
      phone: { show: false, required: false, placeholder: { default: "Phone", en: "Phone", de: "Telefon" } },
      company: {
        show: false,
        required: false,
        placeholder: { default: "Company", en: "Company", de: "Unternehmen" },
      },
    } as unknown as TSurveyContactInfoQuestion;

    test("should return true for a valid ContactInfo question", () => {
      expect(validation.validateQuestion(contactInfoQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if an enabled field has an invalid placeholder", () => {
      const q = {
        ...contactInfoQuestionBase,
        firstName: {
          show: true,
          required: false,
          placeholder: { default: "First Name", en: "First Name", de: "" },
        },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return true if a disabled field has an invalid placeholder", () => {
      const q = {
        ...contactInfoQuestionBase,
        phone: { show: false, required: false, placeholder: { default: "Phone", en: "Phone", de: "" } },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(true);
    });
  });

  // Test Address Question
  describe("Address Question", () => {
    const addressQuestionBase = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "Address", en: "Address", de: "Adresse" },
      addressLine1: {
        show: true,
        required: false,
        placeholder: { default: "Address Line 1", en: "Address Line 1", de: "Adresszeile 1" },
      },
      addressLine2: {
        show: false,
        required: false,
        placeholder: { default: "Address Line 2", en: "Address Line 2", de: "Adresszeile 2" },
      },
      city: { show: true, required: false, placeholder: { default: "City", en: "City", de: "Stadt" } },
      state: {
        show: true,
        required: false,
        placeholder: { default: "State", en: "State", de: "Bundesland" },
      },
      zip: { show: true, required: false, placeholder: { default: "ZIP", en: "ZIP", de: "PLZ" } },
      country: {
        show: true,
        required: false,
        placeholder: { default: "Country", en: "Country", de: "Land" },
      },
    } as unknown as TSurveyAddressQuestion;

    test("should return true for a valid Address question", () => {
      expect(validation.validateQuestion(addressQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if an enabled field has an invalid placeholder", () => {
      const q = {
        ...addressQuestionBase,
        city: { show: true, required: false, placeholder: { default: "City", en: "City", de: "" } },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return true if a disabled field has an invalid placeholder", () => {
      const q = {
        ...addressQuestionBase,
        addressLine2: {
          show: false,
          required: false,
          placeholder: { default: "Address Line 2", en: "Address Line 2", de: "" },
        },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(true);
    });
  });

  // Test PictureSelection Question
  describe("PictureSelection Question", () => {
    const pictureSelectionQuestionBase = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Picture Selection", en: "Picture Selection", de: "Bildauswahl" },
      choices: [
        { id: "p1", imageUrl: "https://example.com/image1.jpg" },
        { id: "p2", imageUrl: "https://example.com/image2.jpg" },
      ],
    } as unknown as TSurveyPictureSelectionQuestion;

    test("should return true for a valid PictureSelection question with at least 2 choices", () => {
      expect(validation.validateQuestion(pictureSelectionQuestionBase, surveyLanguagesEnabled, false)).toBe(
        true
      );
    });

    test("should return false for a PictureSelection question with less than 2 choices", () => {
      const q = {
        ...pictureSelectionQuestionBase,
        choices: [{ id: "p1", imageUrl: "https://example.com/image1.jpg" }],
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });
  });

  // Test CTA Question
  describe("CTA Question", () => {
    const ctaQuestionBase = {
      ...baseQuestionFields,
      type: TSurveyQuestionTypeEnum.CTA,
      headline: { default: "CTA", en: "CTA", de: "CTA" },
      buttonLabel: { default: "Click Me", en: "Click Me", de: "Klick Mich" },
      buttonUrl: "https://example.com",
      dismissButtonLabel: { default: "No Thanks", en: "No Thanks", de: "Nein Danke" },
    } as unknown as TSurveyCTAQuestion;

    test("should return true for a valid CTA question", () => {
      expect(validation.validateQuestion(ctaQuestionBase, surveyLanguagesEnabled, false)).toBe(true);
    });

    test("should return false if dismissButtonLabel is invalid", () => {
      const q = {
        ...ctaQuestionBase,
        dismissButtonLabel: { default: "No Thanks", en: "No Thanks", de: "" },
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(false);
    });

    test("should return true if dismissButtonLabel is not required (required=true)", () => {
      const q = {
        ...ctaQuestionBase,
        required: true,
        dismissButtonLabel: undefined,
      };
      expect(validation.validateQuestion(q, surveyLanguagesEnabled, false)).toBe(true);
    });
  });
});

describe("validation.validateSurveyQuestionsInBatch", () => {
  const q2Valid: TSurveyOpenTextQuestion = {
    id: "q2",
    type: TSurveyQuestionTypeEnum.OpenText,
    headline: { default: "Q2", en: "Q2", de: "Q2" },
    inputType: "text",
    charLimit: {
      enabled: true,
      max: 100,
      min: 0,
    },
    required: false,
  };

  const q2Invalid: TSurveyOpenTextQuestion = {
    id: "q2",
    type: TSurveyQuestionTypeEnum.OpenText,
    headline: { default: "Q2", en: "Q2", de: "" },
    inputType: "text",
    charLimit: {
      enabled: true,
      max: 100,
      min: 0,
    },
    required: false,
  };

  test("should return empty array if invalidQuestions is null", () => {
    expect(validation.validateSurveyQuestionsInBatch(q2Valid, null, surveyLanguagesEnabled, false)).toEqual(
      []
    );
  });

  test("should add question.id if question is invalid and not already in list", () => {
    const invalidQuestions = ["q1"];
    expect(
      validation.validateSurveyQuestionsInBatch(q2Invalid, invalidQuestions, surveyLanguagesEnabled, false)
    ).toEqual(["q1", "q2"]);
  });

  test("should not add question.id if question is invalid but already in list", () => {
    const invalidQuestions = ["q1", "q2"];
    expect(
      validation.validateSurveyQuestionsInBatch(q2Invalid, invalidQuestions, surveyLanguagesEnabled, false)
    ).toEqual(["q1", "q2"]);
  });

  test("should remove question.id if question is valid and in list", () => {
    const invalidQuestions = ["q1", "q2"];
    expect(
      validation.validateSurveyQuestionsInBatch(q2Valid, invalidQuestions, surveyLanguagesEnabled, false)
    ).toEqual(["q1"]);
  });

  test("should not change list if question is valid and not in list", () => {
    const invalidQuestions = ["q1"];
    const validateQuestionSpy = vi.spyOn(validation, "validateQuestion");
    validateQuestionSpy.mockReturnValue(true);
    const result = validation.validateSurveyQuestionsInBatch(
      q2Valid,
      [...invalidQuestions],
      surveyLanguagesEnabled,
      false
    );
    expect(result).toEqual(["q1"]);
  });
});

describe("validation.isSurveyValid", () => {
  const mockT: TFnType = ((key: string) => key) as TFnType;
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
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Q1", en: "Q1", de: "Q1" },
          required: false,
          inputType: "text",
          charLimit: 0,
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
      closeOnDate: null,
      delay: 0,
      displayOption: "displayOnce",
      displayLimit: null,
      runOnDate: null,
      thankYouCard: { enabled: true, title: { default: "Thank you" } }, // Minimal for type check
      createdAt: new Date(),
      updatedAt: new Date(),
      segment: null,
    } as unknown as TSurvey; // Cast to TSurvey, ensure all required fields are present or mocked
  });

  test("should return true for a completely valid survey", () => {
    expect(validation.isSurveyValid(baseSurvey, "en", mockT)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("should return false and toast error if checkForEmptyFallBackValue returns a question", () => {
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue({
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
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
