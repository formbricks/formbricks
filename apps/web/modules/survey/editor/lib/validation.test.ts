import { TFunction } from "i18next";
import { toast } from "react-hot-toast";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TI18nString } from "@formbricks/types/i18n";
import { ZSegmentFilters } from "@formbricks/types/segment";
import {
  TSurveyAddressElement,
  TSurveyCTAElement,
  TSurveyConsentElement,
  TSurveyContactInfoElement,
  TSurveyElementTypeEnum,
  TSurveyMatrixElement,
  TSurveyMultipleChoiceElement,
  TSurveyNPSElement,
  TSurveyOpenTextElement,
  TSurveyPictureSelectionElement,
  TSurveyRatingElement,
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

  // Test MultipleChoiceMulti Element
  describe("MultipleChoiceMulti Element", () => {
    const mcMultiElementBase: TSurveyMultipleChoiceElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: { default: "Multi Choice", en: "Multi Choice", de: "Mehrfachauswahl" },
      choices: [
        { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
        { id: "c2", label: { default: "Option 2", en: "Option 2", de: "Option 2" } },
      ],
      shuffleOption: "none",
    };

    test("should return true for a valid MultipleChoiceMulti element", () => {
      expect(validation.validateElement(mcMultiElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if a choice label is invalid", () => {
      const q = {
        ...mcMultiElementBase,
        choices: [
          { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
          { id: "c2", label: { default: "Option 2", en: "Option 2", de: "" } },
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if there are duplicate choice labels", () => {
      const q = {
        ...mcMultiElementBase,
        choices: [
          { id: "c1", label: { default: "Option 1", en: "Option 1", de: "Option 1" } },
          { id: "c2", label: { default: "Option 1", en: "Option 1", de: "Option 1" } }, // Duplicate
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });

  // Test Picture Selection Element
  describe("PictureSelection Element", () => {
    const pictureSelectionElementBase: TSurveyPictureSelectionElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.PictureSelection,
      headline: { default: "Select Image", en: "Select Image", de: "Bild auswählen" },
      choices: [
        { id: "p1", imageUrl: "https://example.com/img1.jpg" },
        { id: "p2", imageUrl: "https://example.com/img2.jpg" },
      ],
      allowMulti: false,
    };

    test("should return true for a valid PictureSelection element with 2+ choices", () => {
      expect(validation.validateElement(pictureSelectionElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if PictureSelection has less than 2 choices", () => {
      const q = {
        ...pictureSelectionElementBase,
        choices: [{ id: "p1", imageUrl: "https://example.com/img1.jpg" }],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if PictureSelection has 0 choices", () => {
      const q = {
        ...pictureSelectionElementBase,
        choices: [],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });

  // Test CTA Element
  describe("CTA Element", () => {
    const ctaElementBase: TSurveyCTAElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.CTA,
      headline: { default: "Call to Action", en: "Call to Action", de: "Handlungsaufforderung" },
      subheader: { default: "Click below", en: "Click below", de: "Klicke unten" },
      buttonExternal: false,
      required: false,
    };

    test("should return true for a valid CTA element without external button", () => {
      expect(validation.validateElement(ctaElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return true for a valid CTA element with external button and valid label", () => {
      const q: TSurveyCTAElement = {
        ...ctaElementBase,
        buttonExternal: true,
        ctaButtonLabel: { default: "Click", en: "Click", de: "Klicken" },
        buttonUrl: "https://example.com",
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false for CTA with external button but invalid ctaButtonLabel", () => {
      const q: TSurveyCTAElement = {
        ...ctaElementBase,
        buttonExternal: true,
        ctaButtonLabel: { default: "Click", en: "Click", de: "" }, // Invalid German label
        buttonUrl: "https://example.com",
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true for CTA with buttonExternal true but no ctaButtonLabel", () => {
      const q: TSurveyCTAElement = {
        ...ctaElementBase,
        buttonExternal: true,
        buttonUrl: "https://example.com",
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });
  });

  // Test Matrix Element
  describe("Matrix Element", () => {
    const matrixElementBase: TSurveyMatrixElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.Matrix,
      headline: { default: "Matrix Q", en: "Matrix Q", de: "Matrix F" },
      rows: [
        { id: "r1", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } },
        { id: "r2", label: { default: "Row 2", en: "Row 2", de: "Zeile 2" } },
      ],
      columns: [
        { id: "c1", label: { default: "Col 1", en: "Col 1", de: "Spalte 1" } },
        { id: "c2", label: { default: "Col 2", en: "Col 2", de: "Spalte 2" } },
      ],
      shuffleOption: "none",
    };

    test("should return true for a valid Matrix element", () => {
      expect(validation.validateElement(matrixElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if a row label is invalid", () => {
      const q = {
        ...matrixElementBase,
        rows: [
          { id: "r1", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } },
          { id: "r2", label: { default: "Row 2", en: "Row 2", de: "" } }, // Invalid
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if a column label is invalid", () => {
      const q = {
        ...matrixElementBase,
        columns: [
          { id: "c1", label: { default: "Col 1", en: "Col 1", de: "Spalte 1" } },
          { id: "c2", label: { default: "Col 2", en: "Col 2", de: "" } }, // Invalid
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if there are duplicate row labels", () => {
      const q = {
        ...matrixElementBase,
        rows: [
          { id: "r1", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } },
          { id: "r2", label: { default: "Row 1", en: "Row 1", de: "Zeile 1" } }, // Duplicate
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if there are duplicate column labels", () => {
      const q = {
        ...matrixElementBase,
        columns: [
          { id: "c1", label: { default: "Col 1", en: "Col 1", de: "Spalte 1" } },
          { id: "c2", label: { default: "Col 1", en: "Col 1", de: "Spalte 1" } }, // Duplicate
        ],
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });

  // Test ContactInfo Element
  describe("ContactInfo Element", () => {
    const contactInfoElementBase: TSurveyContactInfoElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.ContactInfo,
      headline: { default: "Contact", en: "Contact", de: "Kontakt" },
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
      email: {
        show: true,
        required: false,
        placeholder: { default: "Email", en: "Email", de: "E-Mail" },
      },
      phone: { show: false, required: false, placeholder: { default: "Phone", en: "Phone", de: "Telefon" } },
      company: {
        show: false,
        required: false,
        placeholder: { default: "Company", en: "Company", de: "Firma" },
      },
    };

    test("should return true for a valid ContactInfo element", () => {
      expect(validation.validateElement(contactInfoElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if a visible field placeholder is invalid", () => {
      const q = {
        ...contactInfoElementBase,
        firstName: {
          show: true,
          required: false,
          placeholder: { default: "First Name", en: "First Name", de: "" }, // Invalid
        },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if a hidden field placeholder is invalid (not shown)", () => {
      const q = {
        ...contactInfoElementBase,
        phone: {
          show: false,
          required: false,
          placeholder: { default: "Phone", en: "Phone", de: "" }, // Invalid but hidden
        },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });
  });

  // Test Address Element
  describe("Address Element", () => {
    const addressElementBase: TSurveyAddressElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.Address,
      headline: { default: "Address", en: "Address", de: "Adresse" },
      addressLine1: {
        show: true,
        required: false,
        placeholder: { default: "Address Line 1", en: "Address Line 1", de: "Adresszeile 1" },
      },
      addressLine2: {
        show: true,
        required: false,
        placeholder: { default: "Address Line 2", en: "Address Line 2", de: "Adresszeile 2" },
      },
      city: { show: true, required: false, placeholder: { default: "City", en: "City", de: "Stadt" } },
      state: { show: true, required: false, placeholder: { default: "State", en: "State", de: "Staat" } },
      zip: { show: true, required: false, placeholder: { default: "ZIP", en: "ZIP", de: "PLZ" } },
      country: {
        show: true,
        required: false,
        placeholder: { default: "Country", en: "Country", de: "Land" },
      },
    };

    test("should return true for a valid Address element", () => {
      expect(validation.validateElement(addressElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if a visible field placeholder is invalid", () => {
      const q = {
        ...addressElementBase,
        city: {
          show: true,
          required: false,
          placeholder: { default: "City", en: "City", de: "" }, // Invalid
        },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if a hidden field placeholder is invalid (not shown)", () => {
      const q = {
        ...addressElementBase,
        country: {
          show: false,
          required: false,
          placeholder: { default: "Country", en: "Country", de: "" }, // Invalid but hidden
        },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });
  });

  // Test default validation for elements with upperLabel and lowerLabel
  describe("Default validation for Rating and NPS elements", () => {
    const ratingElementBase: TSurveyRatingElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.Rating,
      headline: { default: "Rating", en: "Rating", de: "Bewertung" },
      range: 5,
      scale: "number",
      lowerLabel: { default: "Bad", en: "Bad", de: "Schlecht" },
      upperLabel: { default: "Good", en: "Good", de: "Gut" },
      isColorCodingEnabled: false,
    };

    test("should return true for a valid Rating element with valid upperLabel and lowerLabel", () => {
      expect(validation.validateElement(ratingElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false if lowerLabel is invalid", () => {
      const q = {
        ...ratingElementBase,
        lowerLabel: { default: "Bad", en: "Bad", de: "" }, // Invalid
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false if upperLabel is invalid", () => {
      const q = {
        ...ratingElementBase,
        upperLabel: { default: "Good", en: "Good", de: "" }, // Invalid
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if lowerLabel is empty/undefined (not validated)", () => {
      const q = {
        ...ratingElementBase,
        lowerLabel: undefined,
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return true if lowerLabel.default is empty string (skipped)", () => {
      const q = {
        ...ratingElementBase,
        lowerLabel: { default: "", en: "", de: "" },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });

    const npsElementBase: TSurveyNPSElement = {
      ...baseElementFields,
      type: TSurveyElementTypeEnum.NPS,
      headline: { default: "NPS", en: "NPS", de: "NPS" },
      lowerLabel: { default: "Not Likely", en: "Not Likely", de: "Unwahrscheinlich" },
      upperLabel: { default: "Very Likely", en: "Very Likely", de: "Sehr wahrscheinlich" },
      isColorCodingEnabled: false,
    };

    test("should return true for a valid NPS element with valid upperLabel and lowerLabel", () => {
      expect(validation.validateElement(npsElementBase, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return false for NPS if lowerLabel is invalid", () => {
      const q = {
        ...npsElementBase,
        lowerLabel: { default: "Not Likely", en: "Not Likely", de: "" },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return false for NPS if upperLabel is invalid", () => {
      const q = {
        ...npsElementBase,
        upperLabel: { default: "Very Likely", en: "Very Likely", de: "" },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });
  });

  // Test subheader validation
  describe("Subheader validation", () => {
    test("should return false if subheader is invalid when provided", () => {
      const q: TSurveyOpenTextElement = {
        ...baseElementFields,
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Open Text", en: "Open Text", de: "Offener Text" },
        subheader: { default: "Enter here", en: "Enter here", de: "" }, // Invalid
        inputType: "text",
        charLimit: { enabled: false },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(false);
    });

    test("should return true if subheader.default is empty (skipped)", () => {
      const q: TSurveyOpenTextElement = {
        ...baseElementFields,
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Open Text", en: "Open Text", de: "Offener Text" },
        subheader: { default: "", en: "", de: "" },
        inputType: "text",
        charLimit: { enabled: false },
      };
      expect(validation.validateElement(q, surveyLanguagesEnabled)).toBe(true);
    });

    test("should return true if there's only one language (default)", () => {
      const q: TSurveyOpenTextElement = {
        ...baseElementFields,
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Open Text", en: "Open Text" },
        subheader: { default: "Some text", en: "Some text", de: "" }, // de empty but only default language
        inputType: "text",
        charLimit: { enabled: false },
      };
      expect(validation.validateElement(q, surveyLanguagesOnlyDefault)).toBe(true);
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
