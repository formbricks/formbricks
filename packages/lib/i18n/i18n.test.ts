import { describe, expect, it } from "vitest";

import { TSurveyLanguage } from "@formbricks/types/surveys";

import {
  mockLegacySurvey,
  mockSurvey,
  mockThankYouCard,
  mockTranslatedSurvey,
  mockTranslatedThankYouCard,
  mockTranslatedWelcomeCard,
  mockWelcomeCard,
} from "./i18n.mock";
import { reverseTranslateSurvey } from "./reverseTranslation";
import { createI18nString, translateSurvey, translateThankYouCard, translateWelcomeCard } from "./utils";

describe("createI18nString", () => {
  it("should create an i18n string from a regular string", () => {
    const result = createI18nString("Hello", ["default"]);
    expect(result).toEqual({ default: "Hello" });
  });

  it("should create a new i18n string with i18n enabled from a previous i18n string", () => {
    const result = createI18nString({ default: "Hello" }, ["default", "es"]);
    expect(result).toEqual({ default: "Hello", es: "" });
  });

  it("should add a new field key value pair when a new language is added", () => {
    const i18nObject = { default: "Hello", es: "Hola" };
    const newLanguages = ["default", "es", "de"];
    const result = createI18nString(i18nObject, newLanguages);
    expect(result).toEqual({
      default: "Hello",
      es: "Hola",
      de: "",
    });
  });

  it("should remove the translation that are not present in newLanguages", () => {
    const i18nObject = { default: "Hello", es: "hola" };
    const newLanguages = ["default"];
    const result = createI18nString(i18nObject, newLanguages);
    expect(result).toEqual({
      default: "Hello",
    });
  });
});

describe("translateWelcomeCard", () => {
  it("should translate all text fields of a welcome card", () => {
    const languages = ["default", "de"];
    const translatedWelcomeCard = translateWelcomeCard(mockWelcomeCard, languages);
    expect(translatedWelcomeCard).toEqual(mockTranslatedWelcomeCard);
  });
});

describe("translateThankYouCard", () => {
  it("should translate all text fields of a Thank you card", () => {
    const languages = ["default", "de"];
    const translatedThankYouCard = translateThankYouCard(mockThankYouCard, languages);
    expect(translatedThankYouCard).toEqual(mockTranslatedThankYouCard);
  });
});

describe("translateSurvey", () => {
  it("should translate all questions of a Survey", () => {
    const languages: TSurveyLanguage[] = [
      {
        default: true,
        enabled: true,
        language: {
          id: "rp2di001zicbm3mk8je1ue9u",
          code: "en",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        default: false,
        enabled: true,
        language: {
          id: "cuuxfzls09sjkueg6lm6n7i0",
          code: "de",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];
    const translatedSurvey = translateSurvey(mockSurvey, languages);
    expect(translatedSurvey).toEqual(mockTranslatedSurvey);
  });
});

describe("translate to Legacy Survey", () => {
  it("should translate all questions of a normal survey to Legacy Survey", () => {
    const translatedSurvey = reverseTranslateSurvey(mockTranslatedSurvey, "default");
    expect(translatedSurvey).toEqual(mockLegacySurvey);
  });
});
