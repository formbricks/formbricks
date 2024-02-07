import { TLanguage } from "@formbricks/types/product";
import { TI18nString } from "@formbricks/types/surveys";

import {
  mockSurvey,
  mockThankYouCard,
  mockTranslatedSurvey,
  mockTranslatedThankYouCard,
  mockTranslatedWelcomeCard,
  mockWelcomeCard,
} from "./i18n.mock";
import {
  createI18nString,
  translateChoice,
  translateSurvey,
  translateThankYouCard,
  translateWelcomeCard,
} from "./utils";

describe("createI18nString", () => {
  it("should create an i18n string from a regular string", () => {
    const result = createI18nString("Hello", ["en"], "en");
    expect(result).toEqual({ en: "Hello" });
  });

  it("should create a new i18n string with i18n enabled from a previous i18n string", () => {
    const result = createI18nString({ en: "Hello" } as unknown as TI18nString, ["en", "es"], "en");
    expect(result).toEqual({ en: "Hello", es: "" });
  });

  it("should add a new field key value pair when a new language is added", () => {
    const i18nObject = { en: "Hello", es: "Hola" } as unknown as TI18nString;
    const newLanguages = ["en", "es", "de"];
    const result = createI18nString(i18nObject, newLanguages, "en");
    expect(result).toEqual({
      en: "Hello",
      es: "Hola",
      de: "",
    });
  });

  it("should remove the translation that are not present in newLanguages", () => {
    const i18nObject = { en: "Hello", es: "hola" } as unknown as TI18nString;
    const newLanguages = ["en"];
    const result = createI18nString(i18nObject, newLanguages, "en");
    expect(result).toEqual({
      en: "Hello",
    });
  });
});

describe("translateChoice", () => {
  it("should translate a choice label to specified languages", () => {
    const choice = { label: "choice", id: "someId" };
    const languages = ["en", "de"];
    const defaultLanguage = "en";
    const translatedChoice = translateChoice(choice, languages, defaultLanguage);
    expect(translatedChoice).toEqual({
      label: {
        en: "choice",
        de: "",
      },
      id: "someId",
    });
  });

  it("should handle cases where choice label is already an i18n object", () => {
    const choice = {
      label: {
        en: "choice",
        de: "",
      },
      id: "someId",
    };
    const languages = ["en", "de"];
    const defaultLanguage = "en";
    const translatedChoice = translateChoice(choice, languages, defaultLanguage);
    expect(translatedChoice).toEqual(choice);
  });

  it("should handle cases where translations are disabled", () => {
    const choice = {
      label: {
        en: "choice",
        de: "",
      },
      id: "someId",
    };
    const languages = ["en"];
    const defaultLanguage = "en";
    const translatedChoice = translateChoice(choice, languages, defaultLanguage);
    expect(translatedChoice).toEqual({
      label: {
        en: "choice",
      },
      id: "someId",
    });
  });
});

describe("translateWelcomeCard", () => {
  it("should translate all text fields of a welcome card", () => {
    const languages = ["en", "de"];
    const defaultLanguage = "en";
    const translatedWelcomeCard = translateWelcomeCard(mockWelcomeCard, languages, defaultLanguage);
    expect(translatedWelcomeCard).toEqual(mockTranslatedWelcomeCard);
  });
});

describe("translateThankYouCard", () => {
  it("should translate all text fields of a Thank you card", () => {
    const languages = ["en", "de"];
    const defaultLanguage = "en";
    const translatedThankYouCard = translateThankYouCard(mockThankYouCard, languages, defaultLanguage);
    expect(translatedThankYouCard).toEqual(mockTranslatedThankYouCard);
  });
});

describe("translateSurvey", () => {
  it("should translate all questions of a Survey", () => {
    const languages: TLanguage[] = [
      {
        id: "en",
        alias: "English",
        default: true,
      },
      {
        id: "de",
        alias: "German",
        default: true,
      },
    ];
    const defaultLanguage = "en";
    const translatedSurvey = translateSurvey(mockSurvey, languages, defaultLanguage);
    expect(translatedSurvey).toEqual(mockTranslatedSurvey);
  });
});
