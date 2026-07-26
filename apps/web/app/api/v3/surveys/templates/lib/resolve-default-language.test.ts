import { describe, expect, test } from "vitest";
import { resolveSurveyDefaultLanguage } from "./resolve-default-language";

describe("resolveSurveyDefaultLanguage", () => {
  test("falls back to the creator's UI locale when no workspace default is set", () => {
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: null,
        workspaceLanguageCodes: ["en-US", "de-DE"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "en-US", translationLocale: "en-US" });
  });

  test("falls back to the creator's UI locale when the workspace default is undefined", () => {
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "fr-FR",
        workspaceLanguageCodes: ["fr-FR"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "fr-FR", translationLocale: "fr-FR" });
  });

  test("uses a configured, translatable workspace default for both the survey default and the copy", () => {
    // English admin (en-US UI) in a German workspace: the survey defaults to German AND the copy is German.
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: "de-DE",
        workspaceLanguageCodes: ["en-US", "de-DE"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "de-DE", translationLocale: "de-DE" });
  });

  test("keeps the copy in the creator's UI locale when the workspace default is not a shipped UI locale", () => {
    // Italian is a valid survey language but Formbricks ships no Italian UI translations, so the copy
    // stays in the creator's locale while the survey default language still becomes Italian.
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: "it-IT",
        workspaceLanguageCodes: ["en-US", "it-IT"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "it-IT", translationLocale: "en-US" });
  });

  test("matches the workspace default against configured languages on the canonical tag", () => {
    // Default stored as legacy "de"; the configured language is canonical "de-DE" — they must match, and
    // the resolved code is canonical.
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: "de",
        workspaceLanguageCodes: ["de-DE"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "de-DE", translationLocale: "de-DE" });
  });

  test("ignores a stale default that is no longer a configured workspace language", () => {
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: "de-DE",
        workspaceLanguageCodes: ["en-US"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "en-US", translationLocale: "en-US" });
  });

  test("ignores an unparseable default code", () => {
    expect(
      resolveSurveyDefaultLanguage({
        requestLocale: "en-US",
        workspaceDefaultLanguageCode: "not-a-language",
        workspaceLanguageCodes: ["en-US"],
      })
    ).toEqual({ surveyDefaultLanguageCode: "en-US", translationLocale: "en-US" });
  });
});
